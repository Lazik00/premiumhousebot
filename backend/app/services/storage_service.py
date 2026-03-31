import asyncio
import re
import uuid
from dataclasses import dataclass
from pathlib import Path

import boto3
from botocore.client import Config as BotoConfig
from botocore.exceptions import BotoCoreError
from botocore.exceptions import ClientError
from botocore.exceptions import EndpointConnectionError

from app.core.media import build_media_url


@dataclass(slots=True)
class StoredObject:
    object_key: str
    image_url: str
    original_name: str
    content_type: str
    size: int


@dataclass(slots=True)
class DownloadedObject:
    body: bytes
    content_type: str


class StorageService:
    def __init__(
        self,
        *,
        endpoint: str | None,
        bucket: str,
        access_key: str | None,
        secret_key: str | None,
    ) -> None:
        self.endpoint = str(endpoint) if endpoint else None
        self.bucket = bucket
        self.access_key = access_key
        self.secret_key = secret_key
        self._client = None

    async def upload_property_image(
        self,
        *,
        filename: str,
        content_type: str | None,
        data: bytes,
        request_base_url: str,
        public_base_url: str | None = None,
    ) -> StoredObject:
        if not self.endpoint or not self.access_key or not self.secret_key:
            raise RuntimeError('S3 storage is not configured')

        object_key = self._build_object_key(filename)
        resolved_content_type = content_type or self._guess_content_type(filename)
        size = len(data)
        try:
            await asyncio.to_thread(self._upload_sync, object_key, data, resolved_content_type)
        except (BotoCoreError, OSError) as exc:
            raise RuntimeError('S3 storage is unavailable') from exc
        image_url = build_media_url(
            object_key,
            request_base_url=request_base_url,
            configured_base_url=public_base_url,
        )
        return StoredObject(
            object_key=object_key,
            image_url=image_url,
            original_name=filename,
            content_type=resolved_content_type,
            size=size,
        )

    async def get_object(self, object_key: str) -> DownloadedObject | None:
        if not self.endpoint or not self.access_key or not self.secret_key:
            raise RuntimeError('S3 storage is not configured')
        try:
            return await asyncio.to_thread(self._download_sync, object_key)
        except (BotoCoreError, OSError) as exc:
            raise RuntimeError('S3 storage is unavailable') from exc

    def _get_client(self):
        if self._client is None:
            self._client = boto3.client(
                's3',
                endpoint_url=self.endpoint,
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.secret_key,
                region_name='us-east-1',
                config=BotoConfig(signature_version='s3v4', s3={'addressing_style': 'path'}),
            )
        return self._client

    def _ensure_bucket(self) -> None:
        client = self._get_client()
        try:
            client.head_bucket(Bucket=self.bucket)
        except ClientError as exc:
            error_code = str(exc.response.get('Error', {}).get('Code', ''))
            if error_code not in {'404', 'NoSuchBucket', 'NotFound'}:
                raise
            client.create_bucket(Bucket=self.bucket)
        except EndpointConnectionError:
            raise

    def _upload_sync(self, object_key: str, data: bytes, content_type: str) -> None:
        self._ensure_bucket()
        client = self._get_client()
        client.put_object(
            Bucket=self.bucket,
            Key=object_key,
            Body=data,
            ContentType=content_type,
            CacheControl='public, max-age=31536000, immutable',
        )

    def _download_sync(self, object_key: str) -> DownloadedObject | None:
        self._ensure_bucket()
        client = self._get_client()
        try:
            response = client.get_object(Bucket=self.bucket, Key=object_key)
        except ClientError as exc:
            error_code = str(exc.response.get('Error', {}).get('Code', ''))
            if error_code in {'404', 'NoSuchKey', 'NotFound'}:
                return None
            raise

        stream = response['Body']
        try:
            body = stream.read()
        finally:
            stream.close()
        return DownloadedObject(
            body=body,
            content_type=response.get('ContentType') or 'application/octet-stream',
        )

    def _build_object_key(self, filename: str) -> str:
        path = Path(filename)
        suffix = path.suffix.lower() if path.suffix else '.jpg'
        stem = re.sub(r'[^a-z0-9]+', '-', path.stem.lower()).strip('-') or 'image'
        return f'properties/{uuid.uuid4()}-{stem}{suffix}'

    @staticmethod
    def _guess_content_type(filename: str) -> str:
        suffix = Path(filename).suffix.lower()
        return {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.webp': 'image/webp',
            '.gif': 'image/gif',
            '.avif': 'image/avif',
            '.svg': 'image/svg+xml',
        }.get(suffix, 'application/octet-stream')
