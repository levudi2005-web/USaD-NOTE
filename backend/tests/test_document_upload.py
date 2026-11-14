import asyncio
import hashlib
import tempfile
import unittest
import uuid
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from fastapi import HTTPException
from starlette.requests import Request

from app.api.v1.documents import upload_document
from app.core.config import settings
from app.storage.file_storage import save_upload_stream, storage_manager


class FakeUpload:
    def __init__(self, chunks):
        self.chunks = iter(chunks)

    async def read(self, _size):
        return next(self.chunks, b"")


def make_request(headers=()):
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/api/v1/documents/upload",
            "headers": list(headers),
            "query_string": b"",
            "server": ("test", 80),
            "client": ("127.0.0.1", 1234),
            "scheme": "http",
            "http_version": "1.1",
            "asgi": {"version": "3.0"},
        }
    )


class DocumentUploadTests(unittest.TestCase):
    def with_temporary_storage(self):
        temporary_directory = tempfile.TemporaryDirectory()
        root = Path(temporary_directory.name)
        document_directory = root / "documents"
        temporary_upload_directory = root / "tmp"
        document_directory.mkdir()
        temporary_upload_directory.mkdir()
        self.addCleanup(temporary_directory.cleanup)
        self.enterContext(patch.object(storage_manager, "doc_dir", document_directory))
        self.enterContext(
            patch.object(storage_manager, "tmp_dir", temporary_upload_directory)
        )
        return document_directory, temporary_upload_directory

    def test_oversized_upload_returns_413(self):
        document_directory, temporary_upload_directory = self.with_temporary_storage()
        upload = FakeUpload([b"four"])
        user = SimpleNamespace(id="user-id", storage_limit=100)

        with (
            patch.object(settings, "MAX_UPLOAD_BYTES", 3),
            patch("app.api.v1.documents.calculate_storage_usage", return_value=0),
        ):
            with self.assertRaises(HTTPException) as raised:
                asyncio.run(
                    upload_document(
                        request=make_request(),
                        file=upload,
                        folder_id=None,
                        user=user,
                        db=Mock(),
                    )
                )

        self.assertEqual(raised.exception.status_code, 413)
        self.assertEqual(list(temporary_upload_directory.iterdir()), [])
        self.assertEqual(list(document_directory.iterdir()), [])

    def test_invalid_signature_returns_415_and_removes_temporary_file(self):
        document_directory, temporary_upload_directory = self.with_temporary_storage()
        upload = FakeUpload([b"not a pdf"])
        user = SimpleNamespace(id="user-id", storage_limit=100)

        with (
            patch.object(settings, "MAX_UPLOAD_BYTES", 100),
            patch("app.api.v1.documents.calculate_storage_usage", return_value=0),
        ):
            with self.assertRaises(HTTPException) as raised:
                asyncio.run(
                    upload_document(
                        request=make_request(),
                        file=upload,
                        folder_id=None,
                        user=user,
                        db=Mock(),
                    )
                )

        self.assertEqual(raised.exception.status_code, 415)
        self.assertEqual(list(temporary_upload_directory.iterdir()), [])
        self.assertEqual(list(document_directory.iterdir()), [])

    def test_upload_exception_removes_temporary_file(self):
        _, temporary_upload_directory = self.with_temporary_storage()

        class FailingUpload:
            def __init__(self):
                self.read_count = 0

            async def read(self, _size):
                self.read_count += 1
                if self.read_count == 1:
                    return b"partial"
                raise RuntimeError("simulated read failure")

        with self.assertRaisesRegex(RuntimeError, "simulated read failure"):
            asyncio.run(
                save_upload_stream(
                    FailingUpload(),
                    "document.txt",
                    100,
                    lambda _signature, _contains_nul: None,
                )
            )

        self.assertEqual(list(temporary_upload_directory.iterdir()), [])

    def test_streamed_upload_hash_and_storage_name_are_safe(self):
        document_directory, _ = self.with_temporary_storage()
        content = b"safe text"

        rel_path, absolute_path, size, checksum = asyncio.run(
            save_upload_stream(
                FakeUpload([content]),
                "../../client/path.txt",
                100,
                lambda _signature, _contains_nul: None,
            )
        )

        stored_name = Path(rel_path).name
        self.assertEqual(size, len(content))
        self.assertEqual(checksum, hashlib.sha256(content).hexdigest())
        self.assertEqual(Path(absolute_path).read_bytes(), content)
        self.assertEqual(Path(absolute_path).parent, document_directory)
        self.assertEqual(Path(rel_path).parent.as_posix(), "documents")
        self.assertEqual(Path(stored_name).suffix, ".txt")
        self.assertEqual(Path(stored_name).stem, uuid.UUID(Path(stored_name).stem).hex)
        self.assertNotIn("client", stored_name)
        self.assertNotIn("path", stored_name)


if __name__ == "__main__":
    unittest.main()
