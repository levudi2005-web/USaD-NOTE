import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.models import (
    Document, Quiz, QuizAttempt, QuizAttemptAnswer, QuizOption, QuizQuestion, User
)
from app.schemas.schemas import (
    QuizCreate, QuizResponse, QuizResultResponse, QuizSubmitRequest
)

router = APIRouter(prefix="/quizzes", tags=["Quizzes"])

@router.get("", response_model=list[QuizResponse])
def list_quizzes(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    quizzes = db.query(Quiz).filter(Quiz.user_id == user.id).all()
    results = []
    for q in quizzes:
        results.append(QuizResponse(
            id=q.id,
            title=q.title,
            description=q.description,
            document_id=q.document_id,
            time_limit_minutes=q.time_limit_sec // 60,
            passing_score=q.passing_score,
            questions_count=len(q.questions),
            created_at=q.created_at
        ))
    return results

@router.post("", response_model=QuizResponse)
def create_quiz(req: QuizCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not req.questions:
        raise HTTPException(status_code=400, detail="Bài thi cần có ít nhất một câu hỏi")

    if req.document_id and not db.query(Document).filter(
        Document.id == req.document_id,
        Document.user_id == user.id,
        Document.is_deleted.is_(False),
    ).first():
        raise HTTPException(status_code=404, detail="Tài liệu không tồn tại")

    for question in req.questions:
        if question.question_type != "single_choice":
            raise HTTPException(status_code=400, detail="Chỉ hỗ trợ câu hỏi trắc nghiệm một đáp án")
        if len(question.options) < 2 or sum(option.is_correct for option in question.options) != 1:
            raise HTTPException(
                status_code=400,
                detail="Mỗi câu hỏi cần ít nhất hai lựa chọn và đúng một đáp án chính xác",
            )

    quiz_id = str(uuid.uuid4())
    quiz = Quiz(
        id=quiz_id,
        user_id=user.id,
        document_id=req.document_id if req.document_id else None,
        title=req.title,
        description=req.description,
        time_limit_sec=req.time_limit_minutes * 60,
        passing_score=req.passing_score
    )
    db.add(quiz)

    for q in req.questions:
        question_id = str(uuid.uuid4())
        question = QuizQuestion(
            id=question_id,
            quiz_id=quiz_id,
            question_text=q.question_text,
            question_type=q.question_type or "single_choice",
            explanation=q.explanation,
            order_index=q.sort_order
        )
        db.add(question)

        for opt in q.options:
            option = QuizOption(
                id=str(uuid.uuid4()),
                question_id=question_id,
                option_text=opt.option_text,
                is_correct=opt.is_correct,
                order_index=opt.sort_order
            )
            db.add(option)

    db.commit()
    db.refresh(quiz)

    return QuizResponse(
        id=quiz.id,
        title=quiz.title,
        description=quiz.description,
        document_id=quiz.document_id,
        time_limit_minutes=quiz.time_limit_sec // 60,
        passing_score=quiz.passing_score,
        questions_count=len(req.questions),
        created_at=quiz.created_at
    )

@router.get("/{quiz_id}")
def get_quiz_for_taking(quiz_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id, Quiz.user_id == user.id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Bài thi không tồn tại")

    questions_data = []
    for q in quiz.questions:
        options_data = []
        for o in q.options:
            options_data.append({
                "id": o.id,
                "text": o.option_text
            })
        questions_data.append({
            "id": q.id,
            "text": q.question_text,
            "type": q.question_type,
            "options": options_data
        })

    return {
        "id": quiz.id,
        "title": quiz.title,
        "description": quiz.description,
        "timeLimit": quiz.time_limit_sec // 60,
        "passingScore": quiz.passing_score,
        "questions": questions_data
    }

@router.post("/{quiz_id}/submit", response_model=QuizResultResponse)
def submit_quiz(quiz_id: str, req: QuizSubmitRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id, Quiz.user_id == user.id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Bài thi không tồn tại")

    total_q = len(quiz.questions)
    if total_q == 0:
        raise HTTPException(status_code=400, detail="Đề thi chưa có câu hỏi")

    question_map = {question.id: question for question in quiz.questions}
    answer_question_ids = [answer.question_id for answer in req.answers]
    if len(answer_question_ids) != len(set(answer_question_ids)):
        raise HTTPException(status_code=400, detail="Không thể gửi nhiều câu trả lời cho cùng một câu hỏi")

    correct_count = 0
    validated_answers = []
    for answer in req.answers:
        question = question_map.get(answer.question_id)
        if not question:
            raise HTTPException(status_code=400, detail="Câu hỏi không thuộc bài thi này")
        option = next(
            (option for option in question.options if option.id == answer.selected_option_id),
            None,
        )
        if not option:
            raise HTTPException(status_code=400, detail="Đáp án không thuộc câu hỏi đã chọn")
        validated_answers.append((answer, option))
        if option.is_correct:
            correct_count += 1

    attempt_id = str(uuid.uuid4())
    completed_at = datetime.now(timezone.utc).replace(tzinfo=None)
    percentage = round((correct_count / total_q) * 100, 1)
    attempt = QuizAttempt(
        id=attempt_id,
        user_id=user.id,
        quiz_id=quiz.id,
        score=percentage,
        correct_answers=correct_count,
        total_questions=total_q,
        duration_sec=req.time_spent_seconds,
        completed_at=completed_at,
    )
    db.add(attempt)

    for ans, option in validated_answers:
        attempt_ans = QuizAttemptAnswer(
            attempt_id=attempt_id,
            question_id=ans.question_id,
            selected_option_id=option.id,
            is_correct=option.is_correct
        )
        db.add(attempt_ans)

    db.commit()

    passed = percentage >= quiz.passing_score
    return QuizResultResponse(
        attempt_id=attempt_id,
        score=correct_count,
        total_questions=total_q,
        percentage=percentage,
        passed=passed,
        correct_answers_count=correct_count,
        time_spent_seconds=req.time_spent_seconds
    )

@router.delete("/{quiz_id}")
def delete_quiz(quiz_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id, Quiz.user_id == user.id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Bài thi không tồn tại")
    db.delete(quiz)
    db.commit()
    return {"message": "Đã xóa bài thi trắc nghiệm"}
