# -*- coding: utf-8 -*-
from __future__ import unicode_literals, absolute_import

from kpi.serializers import AssetFileSerializer
from kpi.views.v2.asset_file import AssetFileViewSet as AssetFileViewSetV2


class AssetFileViewSet(AssetFileViewSetV2):
    """
    ## This document is for a deprecated version of kpi's API.

    **Please upgrade to latest release `/api/v2/assets/{uid}/files/`**
    """

    URL_NAMESPACE = None

    serializer_class = AssetFileSerializer