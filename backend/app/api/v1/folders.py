import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.models import Folder, User
from app.schemas.schemas import FolderCreate, FolderResponse, FolderUpdate

router = APIRouter(prefix="/folders", tags=["Folders"])

@router.get("", response_model=list[FolderResponse])
def list_folders(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Folder).filter(Folder.user_id == user.id).order_by(Folder.name.asc()).all()

@router.post("", response_model=FolderResponse)
def create_folder(req: FolderCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if req.parent_id:
        parent = db.query(Folder).filter(Folder.id == req.parent_id, Folder.user_id == user.id).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Thư mục cha không tồn tại")

    folder = Folder(
        id=str(uuid.uuid4()),
        user_id=user.id,
        parent_id=req.parent_id,
        name=req.name,
        color=req.color or "emerald",
        icon=req.icon or "folder"
    )
    db.add(folder)
    db.commit()
    db.refresh(folder)
    return folder

@router.put("/{folder_id}", response_model=FolderResponse)
def update_folder(folder_id: str, req: FolderUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    folder = db.query(Folder).filter(Folder.id == folder_id, Folder.user_id == user.id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Thư mục không tồn tại")

    if req.name is not None:
        folder.name = req.name
    if req.color is not None:
        folder.color = req.color
    if req.icon is not None:
        folder.icon = req.icon
    if req.parent_id is not None:
        parent_id = req.parent_id or None
        visited = set()
        current_id = parent_id
        while current_id:
            if current_id == folder.id or current_id in visited:
                raise HTTPException(status_code=400, detail="Không thể tạo chu trình trong cấu trúc thư mục")
            visited.add(current_id)
            parent = db.query(Folder).filter(
                Folder.id == current_id,
                Folder.user_id == user.id,
            ).first()
            if not parent:
                raise HTTPException(status_code=404, detail="Thư mục cha không tồn tại")
            current_id = parent.parent_id
        folder.parent_id = parent_id

    db.commit()
    db.refresh(folder)
    return folder

@router.delete("/{folder_id}")
def delete_folder(folder_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    folder = db.query(Folder).filter(Folder.id == folder_id, Folder.user_id == user.id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Thư mục không tồn tại")

    db.delete(folder)
    db.commit()
    return {"message": "Xóa thư mục thành công"}
