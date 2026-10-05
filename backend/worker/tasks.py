from .celery_app import app


@app.task
def test_task():
    return "Celery is working with FriendChat!"


@app.task
def send_message_notification(
    sender_id: str,
    receiver_id: str,
    message_content: str,
):
    print("📩 New message notification")
    print(f"Sender: {sender_id}")
    print(f"Receiver: {receiver_id}")
    print(f"Message: {message_content}")

    return {
        "status": "success",
        "senderId": sender_id,
        "receiverId": receiver_id,
        "message": message_content,
    }
