from fastapi import FastAPI

from worker.tasks import (
    test_task,
    send_message_notification,
)


app = FastAPI(title="FriendChat Celery API")


@app.post("/test")
def run_test_task():
    result = test_task.delay()

    return {
        "message": "Task sent to Celery",
        "taskId": result.id,
    }


@app.post("/message-notification")
def run_message_notification(data: dict):
    result = send_message_notification.delay(
        data["senderId"],
        data["receiverId"],
        data["messageContent"],
    )

    return {
        "message": "Message notification task sent to Celery",
        "taskId": result.id,
    }
