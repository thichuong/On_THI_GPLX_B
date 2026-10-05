import os
import re
import json
import argparse
import glob
import pymupdf
from PIL import Image

# Standard 60 câu điểm liệt trong bộ 600 câu hỏi sát hạch
CAU_LIET_SET = {
    17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32,
    35, 45, 47, 52, 54, 55, 58, 59, 60, 62, 63, 64, 65, 70, 71, 72,
    74, 75, 84, 87, 91, 92, 93, 94, 96, 101, 107, 115, 119, 143, 148,
    151, 153, 160, 199, 209, 213, 216, 227, 228, 233, 242, 246, 258
}

CHAPTERS = [
    {"id": 1, "name": "Quy định chung và quy tắc giao thông đường bộ", "start": 1, "end": 180},
    {"id": 2, "name": "Văn hóa giao thông, đạo đức người lái xe, PCCC & Cứu nạn", "start": 181, "end": 205},
    {"id": 3, "name": "Kỹ thuật lái xe", "start": 206, "end": 263},
    {"id": 4, "name": "Cấu tạo và sửa chữa", "start": 264, "end": 300},
    {"id": 5, "name": "Báo hiệu đường bộ", "start": 301, "end": 485},
    {"id": 6, "name": "Giải thế sa hình và kỹ năng xử lý tình huống", "start": 486, "end": 600},
]

def get_chapter_info(q_id):
    for ch in CHAPTERS:
        if ch["start"] <= q_id <= ch["end"]:
            return ch["id"], ch["name"]
    return 1, CHAPTERS[0]["name"]

def parse_args():
    parser = argparse.ArgumentParser(description="Extract questions and high-resolution images from 600 GPLX PDF")
    parser.add_argument("--pdf", default="600-cau-hoi-sat-hach.pdf", help="Path to input PDF file")
    parser.add_argument("--output-dir", default="public/images", help="Directory to save extracted images")
    parser.add_argument("--questions-file", default="src/data/questions.json", help="Path to questions.json")
    parser.add_argument("--dpi", type=int, default=300, help="Rendering DPI (default: 300 for crisp high-res)")
    parser.add_argument("--format", choices=["webp", "png"], default="webp", help="Image format (default: webp)")
    parser.add_argument("--quality", type=int, default=90, help="WebP quality (default: 90)")
    parser.add_argument("--only-images", action="store_true", help="Only re-extract images and update image URLs in questions.json, preserving existing explanations and question details")
    parser.add_argument("--clean-old", action="store_true", help="Remove old images of differing format in output directory")
    return parser.parse_args()

def main():
    args = parse_args()
    pdf_path = args.pdf
    output_dir = args.output_dir
    os.makedirs(output_dir, exist_ok=True)
    os.makedirs(os.path.dirname(args.questions_file), exist_ok=True)
    
    print(f"Opening PDF: {pdf_path}")
    doc = pymupdf.open(pdf_path)
    print(f"Opened PDF with {len(doc)} pages. Config: DPI={args.dpi}, Format={args.format.upper()}, Quality={args.quality}")
    
    # 1. Collect all lines with underlines and image infos per page
    raw_lines = []
    page_img_map = {}
    
    for pno in range(4, len(doc)):
        page = doc[pno]
        drawings = page.get_drawings()
        underline_rects = [d['rect'] for d in drawings if d.get('fill') == (0,0,0) and d['rect'].height < 2.5]
        img_infos = page.get_image_info()
        page_img_map[pno] = img_infos
        
        blocks = page.get_text('dict')['blocks']
        for b in blocks:
            if 'lines' in b:
                for l in b['lines']:
                    l_rect = pymupdf.Rect(l['bbox'])
                    text = ''.join(s['text'] for s in l['spans']).strip()
                    if not text:
                        continue
                    # Skip page numbers
                    if text.isdigit() and (l_rect.y0 < 55 or l_rect.y1 > 780):
                        continue
                    # Skip chapter headers
                    if text.startswith('CHƯƠNG ') or text in ['GIAO THÔNG ĐƯỜNG BỘ', 'VÀ CỨU HỘ, CỨU NẠN', 'TÌNH HUỐNG GIAO THÔNG', 'CƠ GIỚI ĐƯỜNG BỘ', 'CỤC CẢNH SÁT GIAO THÔNG']:
                        continue
                    
                    raw_lines.append({
                        'text': text,
                        'rect': l_rect,
                        'underline_rects': underline_rects,
                        'pno': pno
                    })

    # 2. Parse lines into questions
    q_pattern = re.compile(r'^Câu\s+(\d+)[\.:\s]\s*(.*)', re.IGNORECASE)
    
    questions = {}
    current_q = None
    current_opt = None
    
    for line in raw_lines:
        t = line['text']
        l_rect = line['rect']
        u_rects = line['underline_rects']
        
        qm = q_pattern.match(t)
        if qm:
            q_num = int(qm.group(1))
            current_q = {
                'id': q_num,
                'question_parts': [qm.group(2).strip()] if qm.group(2).strip() else [],
                'options': {},
                'correct_options': [],
                'pages': [line['pno']],
                'start_line': line,
                'end_line': line,
                'image_path': None
            }
            questions[q_num] = current_q
            current_opt = None
            continue
        
        if current_q is None:
            continue
            
        if line['pno'] not in current_q['pages']:
            current_q['pages'].append(line['pno'])
        current_q['end_line'] = line
        
        # Check if line contains one or more options
        matches = list(re.finditer(r'(?:^|\s{2,})([1-4])\.\s*', t))
        if matches:
            for i, m in enumerate(matches):
                opt_num = int(m.group(1))
                start_char = m.end()
                end_char = matches[i+1].start() if i+1 < len(matches) else len(t)
                opt_text = t[start_char:end_char].strip()
                
                # Approximate bounding box for this option segment on the line
                seg_x0 = l_rect.x0 + (m.start() / len(t)) * l_rect.width
                seg_x1 = l_rect.x0 + (end_char / len(t)) * l_rect.width
                
                is_ul = any(abs(u.y0 - l_rect.y1) < 4.5 and not (u.x1 < seg_x0 or u.x0 > seg_x1) for u in u_rects)
                
                current_opt = opt_num
                if current_opt not in current_q['options']:
                    current_q['options'][current_opt] = []
                if opt_text:
                    current_q['options'][current_opt].append(opt_text)
                if is_ul and current_opt not in current_q['correct_options']:
                    current_q['correct_options'].append(current_opt)
            continue
        
        # Continuation
        if current_opt is not None:
            current_q['options'][current_opt].append(t)
            is_ul = any(abs(u.y0 - l_rect.y1) < 4.5 and not (u.x1 < l_rect.x0 or u.x0 > l_rect.x1) for u in u_rects)
            if is_ul and current_opt not in current_q['correct_options']:
                current_q['correct_options'].append(current_opt)
        else:
            current_q['question_parts'].append(t)

    # 3. Associate and export images for each question
    sorted_q_ids = sorted(questions.keys())
    saved_images_count = 0
    
    print("Extracting and compressing images...")
    for idx, qid in enumerate(sorted_q_ids):
        q = questions[qid]
        for pno in q['pages']:
            page = doc[pno]
            imgs_on_page = page_img_map.get(pno, [])
            
            if not imgs_on_page:
                continue
                
            q_start_y = q['start_line']['rect'].y0 if pno == q['pages'][0] else 0
            next_q_y = 9999
            for next_qid in sorted_q_ids[idx + 1:]:
                next_q = questions[next_qid]
                if next_q['pages'][0] == pno:
                    next_q_y = next_q['start_line']['rect'].y0
                    break
                elif next_q['pages'][0] > pno:
                    break
            
            matched_imgs = []
            for img_info in imgs_on_page:
                img_rect = pymupdf.Rect(img_info['bbox'])
                img_mid_y = (img_rect.y0 + img_rect.y1) / 2
                if q_start_y - 10 <= img_mid_y < next_q_y:
                    matched_imgs.append(img_rect)
            
            if matched_imgs:
                combined_rect = matched_imgs[0]
                for mr in matched_imgs[1:]:
                    combined_rect = combined_rect | mr
                
                # Add safe padding (2 pt) to prevent clipped borders
                pad = 2.0
                clip_rect = pymupdf.Rect(
                    max(0, combined_rect.x0 - pad),
                    max(0, combined_rect.y0 - pad),
                    min(page.rect.x1, combined_rect.x1 + pad),
                    min(page.rect.y1, combined_rect.y1 + pad),
                )
                
                pix = page.get_pixmap(clip=clip_rect, dpi=args.dpi)
                mode = "RGBA" if pix.alpha else "RGB"
                img = Image.frombytes(mode, [pix.width, pix.height], pix.samples)
                
                ext = args.format.lower()
                img_filename = f"cau_{qid}.{ext}"
                img_filepath = os.path.join(output_dir, img_filename)
                
                if ext == "webp":
                    img.save(img_filepath, format="WEBP", quality=args.quality, method=6)
                elif ext == "png":
                    img.save(img_filepath, format="PNG", optimize=True)
                    
                q['image_path'] = f"images/{img_filename}"
                saved_images_count += 1

    # Load existing questions to preserve explanations, answers and custom fields
    existing_map = {}
    if os.path.exists(args.questions_file):
        try:
            with open(args.questions_file, "r", encoding="utf-8") as f:
                for item in json.load(f):
                    existing_map[item["id"]] = item
            print(f"Loaded {len(existing_map)} existing questions from {args.questions_file}")
        except Exception as e:
            print(f"Warning loading existing questions: {e}")

    # Manual adjustments for edge cases (fallback if parsing raw)
    if 204 in questions and not questions[204]['correct_options']:
        questions[204]['correct_options'] = [1]
    if 301 in questions and not questions[301]['correct_options']:
        questions[301]['correct_options'] = [1]
    if 302 in questions and not questions[302]['correct_options']:
        questions[302]['correct_options'] = [2]
    if 352 in questions and not questions[352]['correct_options']:
        questions[352]['correct_options'] = [1]

    if args.only_images and existing_map:
        # Only update image references in existing dataset
        print("Mode: --only-images. Preserving all existing texts, answers, and explanations.")
        for q_id, q_item in existing_map.items():
            if q_id in questions and questions[q_id]['image_path']:
                q_item['image'] = questions[q_id]['image_path']
            elif q_id in questions and not questions[q_id]['image_path']:
                q_item['image'] = None
        final_questions = [existing_map[qid] for qid in sorted(existing_map.keys())]
    else:
        # 4. Format into final structured JSON while preserving explanations and validated fields
        final_questions = []
        for qid in sorted_q_ids:
            q = questions[qid]
            q_text = " ".join(q['question_parts']).strip()
            
            opts = []
            for opt_idx in sorted(q['options'].keys()):
                opts.append(" ".join(q['options'][opt_idx]).strip())
            
            existing_q = existing_map.get(qid, {})
            correct_idx = existing_q.get('correct_option', q['correct_options'][0] if q['correct_options'] else 1)
            ch_id, ch_name = get_chapter_info(qid)
            is_crit = qid in CAU_LIET_SET
            
            # Preserve existing rich explanation if present
            explanation = existing_q.get('explanation')
            if not explanation:
                explanation = "Câu hỏi điểm liệt bắt buộc phải trả lời đúng." if is_crit else ""
            
            final_questions.append({
                "id": qid,
                "chapter": ch_id,
                "chapter_name": ch_name,
                "question": q_text,
                "image": q['image_path'],
                "options": opts,
                "correct_option": correct_idx,
                "is_critical": is_crit,
                "explanation": explanation
            })

    # Save to questions.json
    with open(args.questions_file, "w", encoding="utf-8") as f:
        json.dump(final_questions, f, ensure_ascii=False, indent=2)

    # Clean old images if requested
    if args.clean_old:
        old_pattern = f"cau_*.png" if args.format == "webp" else f"cau_*.webp"
        removed_count = 0
        for old_file in glob.glob(os.path.join(output_dir, old_pattern)):
            try:
                os.remove(old_file)
                removed_count += 1
            except OSError:
                pass
        if removed_count > 0:
            print(f"Cleaned up {removed_count} old images ({old_pattern})")

    print(f"Successfully processed {len(final_questions)} questions!")
    print(f"Saved {saved_images_count} high-resolution images to {output_dir}")
    print(f"Questions with images: {sum(1 for q in final_questions if q['image'])}")
    print(f"Critical questions: {sum(1 for q in final_questions if q['is_critical'])}")
    print(f"File updated at {args.questions_file}")

if __name__ == "__main__":
    main()
