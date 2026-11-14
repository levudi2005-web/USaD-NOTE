import json
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.models import Collection, CollectionItem, Document, FlashcardDeck, Note, User
from app.schemas.schemas import CollectionCreate, CollectionResponse, CollectionUpdate

router = APIRouter(prefix="/collections", tags=["Collections"])

@router.get("", response_model=list[CollectionResponse])
def list_collections(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Collection).filter(Collection.user_id == user.id).order_by(Collection.name.asc()).all()

@router.post("", response_model=CollectionResponse)
def create_collection(req: CollectionCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    coll = Collection(
        id=str(uuid.uuid4()),
        user_id=user.id,
        name=req.name,
        description=req.description,
        color=req.color or "#10b981",
        tags_json=json.dumps(req.tags, ensure_ascii=False) if req.tags else "[]"
    )
    db.add(coll)
    db.commit()
    db.refresh(coll)
    return coll

@router.get("/{collection_id}")
def get_collection(collection_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    coll = db.query(Collection).filter(Collection.id == collection_id, Collection.user_id == user.id).first()
    if not coll:
        raise HTTPException(status_code=404, detail="Bộ sưu tập không tồn tại")

    items = db.query(CollectionItem).filter(CollectionItem.collection_id == coll.id).all()
    item_list = []
    for it in items:
        item_list.append({
            "id": it.id,
            "document_id": it.document_id,
            "note_id": it.note_id,
            "deck_id": it.deck_id,
            "added_at": it.added_at.isoformat()
        })

    return {
        "id": coll.id,
        "name": coll.name,
        "description": coll.description,
        "color": coll.color,
        "tags": json.loads(coll.tags_json) if coll.tags_json else [],
        "items": item_list,
        "created_at": coll.created_at.isoformat()
    }

@router.put("/{collection_id}", response_model=CollectionResponse)
def update_collection(collection_id: str, req: CollectionUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    coll = db.query(Collection).filter(Collection.id == collection_id, Collection.user_id == user.id).first()
    if not coll:
        raise HTTPException(status_code=404, detail="Bộ sưu tập không tồn tại")

    if req.name is not None:
        coll.name = req.name
    if req.description is not None:
        coll.description = req.description
    if req.color is not None:
        coll.color = req.color
    if req.tags is not None:
        coll.tags_json = json.dumps(req.tags, ensure_ascii=False)

    db.commit()
    db.refresh(coll)
    return coll

@router.delete("/{collection_id}")
def delete_collection(collection_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    coll = db.query(Collection).filter(Collection.id == collection_id, Collection.user_id == user.id).first()
    if not coll:
        raise HTTPException(status_code=404, detail="Bộ sưu tập không tồn tại")

    db.delete(coll)
    db.commit()
    return {"message": "Xóa bộ sưu tập thành công"}

@router.post("/{collection_id}/items")
def add_collection_item(
    collection_id: str,
    document_id: Optional[str] = None,
    note_id: Optional[str] = None,
    deck_id: Optional[str] = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    coll = db.query(Collection).filter(Collection.id == collection_id, Collection.user_id == user.id).first()
    if not coll:
        raise HTTPException(status_code=404, detail="Bộ sưu tập không tồn tại")

    # Enforce exclusivity
    non_nulls = sum([bool(document_id), bool(note_id), bool(deck_id)])
    if non_nulls != 1:
        raise HTTPException(status_code=400, detail="Chỉ được liên kết đúng 1 đối tượng (document, note hoặc deck)")

    reference_model, reference_id = (
        (Document, document_id) if document_id else
        (Note, note_id) if note_id else
        (FlashcardDeck, deck_id)
    )
    reference_query = db.query(reference_model).filter(
        reference_model.id == reference_id,
        reference_model.user_id == user.id,
    )
    if reference_model is Document:
        reference_query = reference_query.filter(Document.is_deleted.is_(False))
    if not reference_query.first():
        raise HTTPException(status_code=404, detail="Mục không tồn tại")

    item = CollectionItem(
        collection_id=coll.id,
        document_id=document_id if document_id else None,
        note_id=note_id if note_id else None,
        deck_id=deck_id if deck_id else None
    )
    db.add(item)
    db.commit()
    return {"message": "Đã thêm mục vào bộ sưu tập", "id": item.id}
