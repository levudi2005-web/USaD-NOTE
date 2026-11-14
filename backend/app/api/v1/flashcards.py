import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.models import Document, Flashcard, FlashcardDeck, User
from app.schemas.schemas import (
    CardReviewRequest, FlashcardCreate, FlashcardDeckCreate,
    FlashcardDeckResponse, FlashcardResponse
)

router = APIRouter(prefix="/flashcards", tags=["Flashcards"])

@router.get("/decks", response_model=list[FlashcardDeckResponse])
def list_decks(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    decks = db.query(FlashcardDeck).filter(FlashcardDeck.user_id == user.id).all()
    results = []
    for d in decks:
        results.append(FlashcardDeckResponse(
            id=d.id,
            name=d.name,
            description=d.description,
            color=d.color,
            document_id=d.document_id,
            cards_count=len(d.cards),
            created_at=d.created_at
        ))
    return results

@router.post("/decks", response_model=FlashcardDeckResponse)
def create_deck(req: FlashcardDeckCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if req.document_id and not db.query(Document).filter(
        Document.id == req.document_id,
        Document.user_id == user.id,
        Document.is_deleted.is_(False),
    ).first():
        raise HTTPException(status_code=404, detail="Tài liệu không tồn tại")

    deck_id = str(uuid.uuid4())
    deck = FlashcardDeck(
        id=deck_id,
        user_id=user.id,
        document_id=req.document_id if req.document_id else None,
        name=req.name,
        description=req.description,
        color=req.color or "#10b981",
    )
    db.add(deck)

    for c in req.cards:
        card = Flashcard(
            id=str(uuid.uuid4()),
            deck_id=deck_id,
            front_text=c.front_text,
            back_text=c.back_text,
            is_known=False,
            review_count=0,
        )
        db.add(card)

    db.commit()
    db.refresh(deck)

    return FlashcardDeckResponse(
        id=deck.id,
        name=deck.name,
        description=deck.description,
        color=deck.color,
        document_id=deck.document_id,
        cards_count=len(req.cards),
        created_at=deck.created_at
    )

@router.get("/decks/{deck_id}")
def get_deck(deck_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    deck = db.query(FlashcardDeck).filter(FlashcardDeck.id == deck_id, FlashcardDeck.user_id == user.id).first()
    if not deck:
        raise HTTPException(status_code=404, detail="Bộ thẻ không tồn tại")

    cards = db.query(Flashcard).filter(Flashcard.deck_id == deck.id).all()
    return {
        "id": deck.id,
        "name": deck.name,
        "description": deck.description,
        "color": deck.color,
        "cards": [
            {
                "id": c.id,
                "front": c.front_text,
                "back": c.back_text,
                "known": c.is_known,
                "reviewCount": c.review_count,
                "lastReviewedAt": c.last_reviewed_at.isoformat() if c.last_reviewed_at else None,
            } for c in cards
        ]
    }

@router.delete("/decks/{deck_id}")
def delete_deck(deck_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    deck = db.query(FlashcardDeck).filter(FlashcardDeck.id == deck_id, FlashcardDeck.user_id == user.id).first()
    if not deck:
        raise HTTPException(status_code=404, detail="Bộ thẻ không tồn tại")
    db.delete(deck)
    db.commit()
    return {"message": "Đã xóa bộ thẻ"}

@router.post("/decks/{deck_id}/cards", response_model=FlashcardResponse)
def add_card(deck_id: str, req: FlashcardCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    deck = db.query(FlashcardDeck).filter(FlashcardDeck.id == deck_id, FlashcardDeck.user_id == user.id).first()
    if not deck:
        raise HTTPException(status_code=404, detail="Bộ thẻ không tồn tại")

    card = Flashcard(
        id=str(uuid.uuid4()),
        deck_id=deck.id,
        front_text=req.front_text,
        back_text=req.back_text,
        is_known=False,
        review_count=0,
    )
    db.add(card)
    db.commit()
    db.refresh(card)
    return card

@router.delete("/cards/{card_id}")
def delete_card(card_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    card = db.query(Flashcard).join(FlashcardDeck).filter(Flashcard.id == card_id, FlashcardDeck.user_id == user.id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Thẻ không tồn tại")
    db.delete(card)
    db.commit()
    return {"message": "Đã xóa thẻ ghi nhớ"}

@router.post("/cards/{card_id}/review")
def review_card(card_id: str, req: CardReviewRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    card = db.query(Flashcard).join(FlashcardDeck).filter(Flashcard.id == card_id, FlashcardDeck.user_id == user.id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Thẻ không tồn tại")

    card.is_known = req.known
    card.review_count += 1
    card.last_reviewed_at = datetime.now(timezone.utc).replace(tzinfo=None)

    db.commit()
    return {
        "id": card.id,
        "is_known": card.is_known,
        "review_count": card.review_count,
        "last_reviewed_at": card.last_reviewed_at.isoformat()
    }
