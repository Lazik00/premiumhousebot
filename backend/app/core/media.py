from urllib.parse import urlsplit, urlunsplit


MEDIA_ROUTE_PREFIX = '/api/v1/media/'
INTERNAL_PROXY_PORTS = {8088, 8089, 8100}


def resolve_public_base_url(
    *,
    request_base_url: str | None = None,
    configured_base_url: str | None = None,
) -> str | None:
    base_url = (request_base_url or configured_base_url or '').strip()
    if not base_url:
        return None
    parsed = urlsplit(base_url)
    if not parsed.scheme or not parsed.netloc:
        return base_url.rstrip('/')

    hostname = parsed.hostname or ''
    netloc = hostname
    port = parsed.port
    if port and port not in INTERNAL_PROXY_PORTS:
        is_default_port = (parsed.scheme == 'http' and port == 80) or (parsed.scheme == 'https' and port == 443)
        if not is_default_port:
            netloc = f'{hostname}:{port}'
    return urlunsplit((parsed.scheme, netloc, '', '', '')).rstrip('/')


def build_media_url(
    object_key: str,
    *,
    request_base_url: str | None = None,
    configured_base_url: str | None = None,
) -> str:
    base_url = resolve_public_base_url(
        request_base_url=request_base_url,
        configured_base_url=configured_base_url,
    )
    normalized_key = object_key.lstrip('/')
    if not base_url:
        return f'{MEDIA_ROUTE_PREFIX}{normalized_key}'
    return f'{base_url}{MEDIA_ROUTE_PREFIX}{normalized_key}'


def normalize_media_url(
    image_url: str,
    *,
    object_key: str | None = None,
    request_base_url: str | None = None,
    configured_base_url: str | None = None,
) -> str:
    cleaned_image_url = image_url.strip()
    parsed = urlsplit(cleaned_image_url)
    derived_request_base_url = request_base_url
    if parsed.scheme and parsed.netloc:
        derived_request_base_url = urlunsplit((parsed.scheme, parsed.netloc, '', '', ''))
    normalized_object_key = _normalize_object_key(object_key)
    if normalized_object_key:
        return build_media_url(
            normalized_object_key,
            request_base_url=derived_request_base_url,
            configured_base_url=configured_base_url,
        )

    if parsed.path.startswith(MEDIA_ROUTE_PREFIX):
        derived_object_key = parsed.path.removeprefix(MEDIA_ROUTE_PREFIX)
        return build_media_url(
            derived_object_key,
            request_base_url=derived_request_base_url,
            configured_base_url=configured_base_url,
        )

    if not parsed.scheme or not parsed.netloc:
        return cleaned_image_url

    hostname = parsed.hostname or ''
    netloc = hostname
    port = parsed.port
    if port and port not in INTERNAL_PROXY_PORTS:
        netloc = f'{hostname}:{port}'
    return urlunsplit((parsed.scheme, netloc, parsed.path, parsed.query, parsed.fragment))


def _normalize_object_key(object_key: str | None) -> str | None:
    if not object_key:
        return None
    cleaned = object_key.strip()
    if not cleaned or '://' in cleaned:
        return None
    if cleaned.startswith(MEDIA_ROUTE_PREFIX):
        return cleaned.removeprefix(MEDIA_ROUTE_PREFIX)
    return cleaned.lstrip('/')
