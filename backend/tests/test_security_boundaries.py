import tempfile
import unittest
import zipfile
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

import py7zr
from fastapi import HTTPException

from app.api.deps import get_optional_user
from app.api.v1.archives import extract_archive_files
from app.schemas.schemas import ArchiveExtractRequest
from app.core.config import settings
from app.models.models import User
from app.storage.file_storage import StorageManager
from app.storage.quota import calculate_storage_usage


class StoragePathTests(unittest.TestCase):
    def test_rejects_sibling_path_with_root_prefix(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            base = Path(temporary_directory)
            storage_root = base / "storage"
            sibling = base / "storage-outside"
            storage_root.mkdir()
            sibling.mkdir()

            manager = StorageManager.__new__(StorageManager)
            manager.root = storage_root

            with self.assertRaises(ValueError):
                manager.get_absolute_path("../storage-outside/secret.txt")

    def test_resolves_path_inside_storage_root(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            storage_root = Path(temporary_directory) / "storage"
            storage_root.mkdir()

            manager = StorageManager.__new__(StorageManager)
            manager.root = storage_root

            self.assertEqual(
                manager.get_absolute_path("documents/file.txt"),
                storage_root.resolve() / "documents" / "file.txt",
            )

    def test_archive_inspection_rejects_traversal_paths(self):
        manager = StorageManager.__new__(StorageManager)
        with tempfile.TemporaryDirectory() as temporary_directory:
            archive_path = Path(temporary_directory) / "unsafe.zip"
            with zipfile.ZipFile(archive_path, "w") as archive:
                archive.writestr("../outside.txt", "unsafe")

            with self.assertRaisesRegex(ValueError, "đường dẫn"):
                manager.inspect_archive(str(archive_path), ".zip")

    def test_archive_inspection_enforces_entry_limit(self):
        manager = StorageManager.__new__(StorageManager)
        with tempfile.TemporaryDirectory() as temporary_directory:
            archive_path = Path(temporary_directory) / "many.zip"
            with zipfile.ZipFile(archive_path, "w") as archive:
                archive.writestr("one.txt", "content")

            with patch.object(settings, "MAX_ARCHIVE_ENTRIES", 0):
                with self.assertRaisesRegex(ValueError, "số lượng tệp"):
                    manager.inspect_archive(str(archive_path), ".zip")

    def test_archive_inspection_enforces_path_depth_boundary(self):
        manager = StorageManager.__new__(StorageManager)
        for depth in (
            settings.MAX_ARCHIVE_PATH_DEPTH,
            settings.MAX_ARCHIVE_PATH_DEPTH + 1,
        ):
            with tempfile.TemporaryDirectory() as temporary_directory:
                archive_path = Path(temporary_directory) / "nested.zip"
                archive_name = f"{'nested/' * depth}file.txt"
                with zipfile.ZipFile(archive_path, "w") as archive:
                    archive.writestr(archive_name, "content")

                if depth == settings.MAX_ARCHIVE_PATH_DEPTH:
                    manager.inspect_archive(str(archive_path), ".zip")
                else:
                    with self.assertRaisesRegex(ValueError, "độ sâu thư mục"):
                        manager.inspect_archive(str(archive_path), ".zip")

    def test_7z_archive_can_be_inspected_and_selectively_extracted(self):
        manager = StorageManager.__new__(StorageManager)
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            source_path = root / "source.txt"
            source_path.write_text("sample 7z payload", encoding="utf-8")
            archive_path = root / "sample.7z"
            with py7zr.SevenZipFile(archive_path, mode="w") as archive:
                archive.write(source_path, arcname="folder/source.txt")

            manager.root = root / "storage"
            manager.doc_dir = manager.root / "documents"
            manager.doc_dir.mkdir(parents=True)

            manifest, _, _ = manager.inspect_archive(str(archive_path), ".7z")
            self.assertEqual(manifest[0]["path"], "folder/source.txt")
            results = manager.extract_selective(
                str(archive_path), ".7z", ["folder/source.txt"]
            )

            self.assertEqual(len(results), 1)
            extracted_path = manager.get_absolute_path(results[0]["storage_path"])
            self.assertEqual(extracted_path.read_text(encoding="utf-8"), "sample 7z payload")

            manager.remove_saved_files(results)


class StorageQuotaTests(unittest.TestCase):
    def test_usage_is_recomputed_without_mutating_the_user_during_upload(self):
        document_query = Mock()
        document_query.filter.return_value = document_query
        document_query.scalar.return_value = 10
        archive_query = Mock()
        archive_query.filter.return_value = archive_query
        archive_query.scalar.return_value = 5
        db = Mock()
        db.query.side_effect = [document_query, archive_query]
        user = User(id="user-id", storage_used=999)

        used = calculate_storage_usage(db, user)

        self.assertEqual(used, 15)
        self.assertEqual(user.storage_used, 999)


class OptionalAuthenticationTests(unittest.TestCase):
    def test_invalid_optional_token_is_anonymous(self):
        with patch(
            "app.api.deps.get_current_user",
            side_effect=HTTPException(status_code=401, detail="invalid token"),
        ):
            self.assertIsNone(get_optional_user("Bearer invalid", Mock()))

    def test_database_errors_are_not_silently_treated_as_anonymous(self):
        database_error = RuntimeError("database unavailable")
        with patch(
            "app.api.deps.get_current_user",
            side_effect=database_error,
        ):
            with self.assertRaisesRegex(RuntimeError, "database unavailable"):
                get_optional_user("Bearer token", Mock())


class ArchiveOwnershipTests(unittest.TestCase):
    def test_rejects_foreign_target_folder_before_extraction(self):
        archive = SimpleNamespace(
            id="archive-id",
            storage_path="archives/archive.zip",
        )
        archive_query = Mock()
        archive_query.filter.return_value.first.return_value = archive
        folder_query = Mock()
        folder_query.filter.return_value.first.return_value = None
        db = Mock()
        db.query.side_effect = [archive_query, folder_query]

        with self.assertRaises(HTTPException) as raised:
            extract_archive_files(
                "archive-id",
                ArchiveExtractRequest(
                    inner_paths=["notes.txt"],
                    target_folder_id="another-users-folder",
                ),
                SimpleNamespace(id="user-id"),
                db,
            )

        self.assertEqual(raised.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
