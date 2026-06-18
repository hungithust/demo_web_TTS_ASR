from fastapi import Request
from fastapi.responses import JSONResponse


class APIError(Exception):
    status_code = 500

    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class InvalidModelError(APIError):
    status_code = 400


class InvalidAudioError(APIError):
    status_code = 400


class EngineError(APIError):
    status_code = 502


class EngineTimeoutError(APIError):
    status_code = 504


class InvalidTrialError(APIError):
    status_code = 400


class NoTrialAvailableError(APIError):
    status_code = 404


async def api_error_handler(request: Request, exc: APIError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})
