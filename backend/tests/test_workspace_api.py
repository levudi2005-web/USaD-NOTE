import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import Mock, patch

from fastapi import HTTPException

from app.api.v1.collections import add_collection_item
from app.api.v1.collections import create_collection
from app.api.v1.flashcards import create_deck, review_card
from app.api.v1.folders import update_folder
from app.api.v1.notes import _validate_note_references, create_note
from app.api.v1.quizzes import create_quiz, get_quiz_for_taking, submit_quiz
from app.api.v1.sharing import (
    _ensure_link_active,
    _normalize_expiry,
    _verify_link_password,
    rotate_shared_link,
    update_shared_link,
)
from app.models.models import Flashcard, FlashcardDeck, Quiz, QuizOption, QuizQuestion
from app.schemas.schemas import (
    CardReviewRequest,
    CollectionCreate,
    FlashcardCreate,
    FlashcardDeckCreate,
    FolderUpdate,
    NoteCreate,
    QuizCreate,
    QuizOptionCreate,
    QuizQuestionCreate,
    QuizSubmitAnswer,
    QuizSubmitRequest,
    SharedLinkUpdate,
)


class OwnershipBoundaryTests(unittest.TestCase):
    def test_note_rejects_foreign_folder(self):
        query = Mock()
        query.filter.return_value.first.return_value = None
        db = Mock()
        db.query.return_value = query

        with self.assertRaises(HTTPException) as raised:
            _validate_note_references(db, "user-a", "user-b-folder", None)

        self.assertEqual(raised.exception.status_code, 404)

    def test_note_creation_persists_tags(self):
        db = Mock()
        db.refresh.side_effect = lambda note: (
            setattr(note, "created_at", datetime.now(timezone.utc).replace(tzinfo=None)),
            setattr(note, "updated_at", datetime.now(timezone.utc).replace(tzinfo=None)),
        )

        response = create_note(
            NoteCreate(title="Tagged", tags=["biology", "review"]),
            SimpleNamespace(id="user-a"),
            db,
        )

        self.assertEqual(response.tags, ["biology", "review"])
        self.assertEqual(db.add.call_args.args[0].tags, ["biology", "review"])

    def test_collection_rejects_foreign_document(self):
        collection = SimpleNamespace(id="collection-a")
        collection_query = Mock()
        collection_query.filter.return_value.first.return_value = collection
        document_query = Mock()
        document_query.filter.return_value = document_query
        document_query.first.return_value = None
        db = Mock()
        db.query.side_effect = [collection_query, document_query]

        with self.assertRaises(HTTPException) as raised:
            add_collection_item(
                "collection-a",
                document_id="document-b",
                user=SimpleNamespace(id="user-a"),
                db=db,
            )

        self.assertEqual(raised.exception.status_code, 404)
        db.add.assert_not_called()

    def test_collection_creation_persists_tags(self):
        db = Mock()
        db.refresh.side_effect = lambda collection: (
            setattr(collection, "created_at", datetime.now(timezone.utc).replace(tzinfo=None)),
            setattr(collection, "updated_at", datetime.now(timezone.utc).replace(tzinfo=None)),
        )

        response = create_collection(
            CollectionCreate(name="Tagged", tags=["exam"]),
            SimpleNamespace(id="user-a"),
            db,
        )

        self.assertEqual(response.tags, ["exam"])
        self.assertEqual(db.add.call_args.args[0].tags, ["exam"])

    def test_folder_move_rejects_cycle(self):
        folder = SimpleNamespace(id="folder-a", parent_id=None)
        descendant = SimpleNamespace(id="folder-b", parent_id="folder-a")
        folder_query = Mock()
        folder_query.filter.return_value.first.return_value = folder
        parent_query = Mock()
        parent_query.filter.return_value.first.return_value = descendant
        db = Mock()
        db.query.side_effect = [folder_query, parent_query]

        with self.assertRaises(HTTPException) as raised:
            update_folder(
                "folder-a",
                FolderUpdate(parent_id="folder-b"),
                SimpleNamespace(id="user-a"),
                db,
            )

        self.assertEqual(raised.exception.status_code, 400)
        db.commit.assert_not_called()


class LearningApiTests(unittest.TestCase):
    def test_flashcard_deck_creation_uses_persisted_model_fields(self):
        db = Mock()

        def refresh(deck):
            deck.created_at = datetime.now(timezone.utc).replace(tzinfo=None)

        db.refresh.side_effect = refresh
        response = create_deck(
            FlashcardDeckCreate(
                name="Basics",
                color="#123456",
                cards=[FlashcardCreate(front_text="Q", back_text="A")],
            ),
            SimpleNamespace(id="user-a"),
            db,
        )

        created = [call.args[0] for call in db.add.call_args_list]
        deck = next(item for item in created if isinstance(item, FlashcardDeck))
        card = next(item for item in created if isinstance(item, Flashcard))
        self.assertEqual(response.color, "#123456")
        self.assertEqual(deck.color, "#123456")
        self.assertEqual((card.front_text, card.back_text, card.review_count), ("Q", "A", 0))

    def test_flashcard_review_updates_existing_review_fields(self):
        card = SimpleNamespace(
            id="card-a",
            is_known=False,
            review_count=0,
            last_reviewed_at=None,
        )
        query = Mock()
        query.join.return_value = query
        query.filter.return_value.first.return_value = card
        db = Mock()
        db.query.return_value = query

        result = review_card(
            "card-a",
            CardReviewRequest(known=True),
            SimpleNamespace(id="user-a"),
            db,
        )

        self.assertTrue(card.is_known)
        self.assertEqual(card.review_count, 1)
        self.assertIsNotNone(card.last_reviewed_at)
        self.assertTrue(result["is_known"])

    def test_quiz_creation_persists_api_fields_in_matching_columns(self):
        db = Mock()
        db.refresh.side_effect = lambda quiz: setattr(
            quiz, "created_at", datetime.now(timezone.utc).replace(tzinfo=None)
        )
        response = create_quiz(
            QuizCreate(
                title="Basics",
                time_limit_minutes=5,
                passing_score=70,
                questions=[
                    QuizQuestionCreate(
                        question_text="Question",
                        sort_order=3,
                        options=[
                            QuizOptionCreate(option_text="Wrong", sort_order=1),
                            QuizOptionCreate(option_text="Right", is_correct=True, sort_order=2),
                        ],
                    )
                ],
            ),
            SimpleNamespace(id="user-a"),
            db,
        )

        created = [call.args[0] for call in db.add.call_args_list]
        quiz = next(item for item in created if isinstance(item, Quiz))
        question = next(item for item in created if isinstance(item, QuizQuestion))
        options = [item for item in created if isinstance(item, QuizOption)]
        self.assertEqual(response.time_limit_minutes, 5)
        self.assertEqual(quiz.time_limit_sec, 300)
        self.assertEqual(quiz.passing_score, 70)
        self.assertEqual(question.order_index, 3)
        self.assertEqual(question.question_type, "single_choice")
        self.assertEqual({option.question_id for option in options}, {question.id})

    def test_quiz_submission_rejects_questions_outside_the_quiz(self):
        quiz = SimpleNamespace(
            id="quiz-a",
            passing_score=80,
            questions=[SimpleNamespace(id="question-a", options=[])],
        )
        query = Mock()
        query.filter.return_value.first.return_value = quiz
        db = Mock()
        db.query.return_value = query

        with self.assertRaises(HTTPException) as raised:
            submit_quiz(
                "quiz-a",
                QuizSubmitRequest(
                    answers=[
                        QuizSubmitAnswer(
                            question_id="question-b",
                            selected_option_id="option-b",
                        )
                    ]
                ),
                SimpleNamespace(id="user-a"),
                db,
            )

        self.assertEqual(raised.exception.status_code, 400)
        db.add.assert_not_called()

    def test_quiz_read_uses_persisted_time_limit(self):
        quiz = SimpleNamespace(
            id="quiz-a",
            title="Quiz",
            description=None,
            time_limit_sec=600,
            passing_score=75,
            questions=[],
        )
        query = Mock()
        query.filter.return_value.first.return_value = quiz
        db = Mock()
        db.query.return_value = query

        response = get_quiz_for_taking(
            "quiz-a",
            SimpleNamespace(id="user-a"),
            db,
        )

        self.assertEqual(response["timeLimit"], 10)
        self.assertEqual(response["passingScore"], 75)


class SharedLinkBoundaryTests(unittest.TestCase):
    def test_share_expiry_preserves_timezone_aware_timestamp(self):
        requested = datetime.now(timezone.utc) + timedelta(hours=3, minutes=17)

        normalized = _normalize_expiry(requested)

        self.assertEqual(normalized, requested.replace(tzinfo=None))

    def test_share_update_changes_settings_and_can_clear_password(self):
        link = SimpleNamespace(
            id="share-a",
            document_id="document-a",
            title="Old title",
            allow_download=True,
            views_count=3,
            password_hash="stored-hash",
            is_revoked=False,
            expires_at=None,
            created_at=datetime.now(timezone.utc).replace(tzinfo=None),
        )
        query = Mock()
        query.filter.return_value.first.return_value = link
        db = Mock()
        db.query.return_value = query

        response = update_shared_link(
            "share-a",
            SharedLinkUpdate(
                share_name="New title",
                allow_download=False,
                expires_in_days=0,
                password=None,
            ),
            SimpleNamespace(id="user-a"),
            db,
        )

        self.assertEqual(link.title, "New title")
        self.assertFalse(link.allow_download)
        self.assertIsNone(link.expires_at)
        self.assertIsNone(link.password_hash)
        self.assertEqual(response.document_id, "document-a")
        self.assertFalse(response.has_password)

    def test_rotating_share_replaces_token_and_reactivates_link(self):
        link = SimpleNamespace(
            id="share-a",
            document_id="document-a",
            title="Share",
            allow_download=True,
            views_count=0,
            password_hash=None,
            is_revoked=True,
            failed_pass_attempts=5,
            pass_locked_until=datetime.now(timezone.utc).replace(tzinfo=None),
            expires_at=None,
            created_at=datetime.now(timezone.utc).replace(tzinfo=None),
        )
        query = Mock()
        query.filter.return_value.first.return_value = link
        db = Mock()
        db.query.return_value = query

        with patch("app.api.v1.sharing.secrets.token_urlsafe", return_value="new-token"), patch(
            "app.api.v1.sharing.hash_sha256", return_value="new-token-hash"
        ):
            response = rotate_shared_link(
                "share-a",
                SimpleNamespace(id="user-a"),
                db,
            )

        self.assertEqual(link.token_hash, "new-token-hash")
        self.assertFalse(link.is_revoked)
        self.assertEqual(link.failed_pass_attempts, 0)
        self.assertIsNone(link.pass_locked_until)
        self.assertEqual(response.token, "new-token")
        self.assertEqual(response.share_url, "/share/?token=new-token")
        db.commit.assert_called_once()

    def test_expired_share_link_is_rejected(self):
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        link = SimpleNamespace(is_revoked=False, expires_at=now - timedelta(seconds=1))

        with self.assertRaises(HTTPException) as raised:
            _ensure_link_active(link, now)

        self.assertEqual(raised.exception.status_code, 410)

    def test_share_password_lockout_is_enforced(self):
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        link = SimpleNamespace(
            pass_locked_until=now + timedelta(minutes=1),
            password_hash="hash",
            failed_pass_attempts=5,
        )

        with self.assertRaises(HTTPException) as raised:
            _verify_link_password(link, "password", Mock(), now)

        self.assertEqual(raised.exception.status_code, 429)

    def test_fifth_incorrect_share_password_starts_lockout(self):
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        link = SimpleNamespace(
            pass_locked_until=None,
            password_hash="hash",
            failed_pass_attempts=4,
        )
        db = Mock()

        with patch("app.api.v1.sharing.verify_password", return_value=False):
            with self.assertRaises(HTTPException) as raised:
                _verify_link_password(link, "wrong", db, now)

        self.assertEqual(raised.exception.status_code, 401)
        self.assertEqual(link.failed_pass_attempts, 5)
        self.assertEqual(link.pass_locked_until, now + timedelta(minutes=15))
        db.commit.assert_called_once()


if __name__ == "__main__":
    unittest.main()
