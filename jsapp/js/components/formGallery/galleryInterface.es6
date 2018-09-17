/*
this handles storing and managing gallery data
*/

import Reflux from 'reflux';
import stores from 'js/stores';
import {dataInterface} from 'js/dataInterface';
import {
  t,
  assign,
  stateChanges,
  formatTimeDate
} from 'js/utils';
import {MODAL_TYPES} from 'js/constants';

export const PAGE_SIZE = 12;
export const GROUPBY_OPTIONS = {
  question: {
    value: 'question',
    label: t('Group by question')
  },
  submission: {
    value: 'submission',
    label: t('Group by record')
  }
}
export const ORDER_OPTIONS = {
  asc: {
    label: t('Show oldest first'),
    value: 'asc'
  },
  desc: {
    label: t('Show latest first'),
    value: 'desc'
  }
};

export const galleryActions = Reflux.createActions([
  'setFormUid',
  'toggleFullscreen',
  'openMediaModal',
  'selectGalleryMedia',
  'selectPreviousGalleryMedia',
  'selectNextGalleryMedia',
  'setFilters',
  'loadMoreGalleries',
  'loadMoreGalleryMedias',
  'wipeLoadedGalleryData'
]);

galleryActions.openMediaModal.listen(({galleryIndex, mediaIndex}) => {
  galleryActions.selectGalleryMedia({galleryIndex, mediaIndex});
  stores.pageState.showModal({type: MODAL_TYPES.GALLERY_MEDIA});
});

class GalleryStore extends Reflux.Store {
  constructor() {
    super();
    this.listenables = galleryActions;
    this.state = this.getInitialState();
  }

  /*
  managing state
  */

  getInitialState() {
    const stateObj = {}
    assign(stateObj, {
      formUid: null,
      isFullscreen: false,
      filterQuery: '',
      filterGroupBy: GROUPBY_OPTIONS.question,
      filterOrder: ORDER_OPTIONS.asc,
      isLoadingGalleries: false,
    });
    assign(stateObj, this.getWipedGalleriesState());
    return stateObj;
  }

  getWipedGalleriesState() {
    return {
      galleries: [],
      nextGalleriesPageUrl: null,
      totalMediaCount: null,
      selectedMedia: new SelectedMedia()
    }
  }

  setState(newState) {
    let changes = stateChanges(this.state, newState);
    if (changes) {
      assign(this.state, newState);
      this.trigger(changes);
    }
  }

  resetStateToInitial() {
    this.setState(this.getInitialState());
  }

  /*
  managing actions
  */

  onSetFormUid(uid) {
    this.setState({formUid: uid});
    if (uid === null) {
      this.resetStateToInitial();
    } else {
      this.wipeAndLoadData();
    }

  }

  onToggleFullscreen() {
    this.setState({isFullscreen: !this.state.isFullscreen});
  }

  onSelectGalleryMedia({galleryIndex, mediaIndex}) {
    const targetGallery = this.state.galleries[galleryIndex];

    this.setState({
      selectedMedia: new SelectedMedia(targetGallery, mediaIndex)
    });
  }

  onSetFilters(filters) {
    let needsWipeAndLoad = false;

    const updateObj = {};
    if (typeof filters.filterQuery !== 'undefined') {
      updateObj.filterQuery = filters.filterQuery;
    }
    if (typeof filters.filterGroupBy !== 'undefined') {
      updateObj.filterGroupBy = filters.filterGroupBy;
      if (updateObj.filterGroupBy.value !== this.state.filterGroupBy.value) {
        needsWipeAndLoad = true;
      }
    }
    if (typeof filters.filterOrder !== 'undefined') {
      updateObj.filterOrder = filters.filterOrder;
      if (updateObj.filterOrder.value !== this.state.filterOrder.value) {
        needsWipeAndLoad = true;
      }
    }
    this.setState(updateObj);

    if (needsWipeAndLoad) {
      this.wipeAndLoadData();
    }
  }

  onLoadMoreGalleries() {
    if (this.state.nextGalleriesPageUrl) {
      this.loadNextGalleriesPage();
    } else {
      throw new Error('No more galleries to load!');
    }
  }

  onLoadMoreGalleryMedias(galleryIndex, pageToLoad=null, pageSize=PAGE_SIZE) {
    const targetGallery = this.state.galleries[galleryIndex];
    if (pageToLoad === null) {
      pageToLoad = targetGallery.guessNextPageToLoad()
    }
    if (pageToLoad !== null) {
      this.loadNextGalleryMediasPage(galleryIndex, pageToLoad, pageSize, this.state.filterOrder.value);
    } else {
      throw new Error('No more gallery medias to load!');
    }
  }

  onWipeLoadedGalleryData(galleryIndex) {
    const targetGallery = this.state.galleries[galleryIndex];
    targetGallery.wipeLoadedData();
    this.trigger({galleries: this.state.galleries});
  }

  /*
  fetching data from endpoint
  */

  wipeAndLoadData() {
    this.setState(this.getWipedGalleriesState());
    this.setState({isLoadingGalleries: true});
    dataInterface.filterGalleryImages(
      this.state.formUid,
      this.state.filterGroupBy.value,
      PAGE_SIZE,
      this.state.filterOrder.value
    )
      .done((response) => {
        this.buildAndAddGalleries(response.results);
        this.setState({
          totalMediaCount: response.attachments_count,
          nextGalleriesPageUrl: response.next || null,
          isLoadingGalleries: false
        });
      });
  }

  loadNextGalleriesPage() {
    this.setState({isLoadingGalleries: true});
    dataInterface.loadNextPageUrl(this.state.nextGalleriesPageUrl)
      .done((response) => {
        this.buildAndAddGalleries(response.results);
        this.setState({
          totalMediaCount: response.attachments_count,
          nextGalleriesPageUrl: response.next || null,
          isLoadingGalleries: false
        });
      });
  }

  loadNextGalleryMediasPage(galleryIndex, pageToLoad, pageSize, sort) {
    const targetGallery = this.state.galleries[galleryIndex];
    targetGallery.setIsLoadingMedias(true);
    this.trigger({galleries: this.state.galleries});

    dataInterface.loadMoreAttachments(
      this.state.formUid,
      this.state.filterGroupBy.value,
      galleryIndex,
      pageToLoad,
      pageSize,
      sort
    )
      .done((response) => {
        const targetGallery = this.state.galleries[galleryIndex];
        targetGallery.addMedias(response.attachments.results, pageToLoad - 1, pageSize);
        targetGallery.setIsLoadingMedias(false);
        this.trigger({galleries: this.state.galleries});
      });
  }

  buildAndAddGalleries(results) {
    results.forEach((result) => {
      const galleryInstance = new Gallery(result);
      this.state.galleries[galleryInstance.galleryIndex] = galleryInstance;
    });
    this.trigger({galleries: this.state.galleries});
  }
}

class Gallery {
  constructor(galleryData) {
    this.galleryIndex = galleryData.index;
    this.isLoadingMedias = false;
    this.medias = [];
    this.loadedMediaCount = 0;
    this.totalMediaCount = galleryData.attachments.count;
    this.title = this.buildGalleryTitle(galleryData);
    this.dateCreated = this.buildGalleryDate(galleryData);

    this.addMedias(galleryData.attachments.results);
  }

  hasMoreMediasToLoad() {
    return this.loadedMediaCount < this.totalMediaCount;
  }

  setIsLoadingMedias(isLoadingMedias) {
    this.isLoadingMedias = isLoadingMedias;
  }

  wipeLoadedData() {
    this.medias = [];
    this.loadedMediaCount = [];
  }

  guessNextPageToLoad() {
    if (this.totalMediaCount === this.loadedMediaCount) {
      return null;
    } else {
      const currentPage = this.loadedMediaCount / PAGE_SIZE;
      return currentPage + 1;
    }
  }

  buildGalleryTitle(galleryData) {
    if (galleryStore.state.filterGroupBy.value === GROUPBY_OPTIONS.question.value) {
      return galleryData.label || t('Unknown question');
    } else {
      return t('Record ##number##').replace('##number##', parseInt(this.galleryIndex) + 1);
    }
  }

  buildGalleryDate(galleryData) {
    if (galleryData.date_created) {
      return formatTimeDate(galleryData.date_created);
    } else if (galleryData.attachments.results[0] && galleryData.attachments.results[0].submission) {
      return formatTimeDate(galleryData.attachments.results[0].submission.date_created);
    } else {
      console.error('Unknown gallery date created');
    }
  }

  findMedia(mediaIndex) {
    return this.medias.find((media) => {return media.mediaIndex === mediaIndex}) || null;
  }

  addMedias(medias, pageOffset=0, pageSize=PAGE_SIZE) {
    medias.forEach((mediaData, index) => {
      // TODO this is possibly wrong information, would be best if backend
      // would provide real index
      const mediaIndex = index + pageOffset * pageSize;
      this.medias[mediaIndex] = {
        galleryIndex: this.galleryIndex,
        mediaIndex: mediaIndex,
        mediaId: mediaData.id,
        title: this.buildMediaTitle(mediaData, mediaIndex),
        date: this.buildMediaDate(mediaData),
        filename: mediaData.short_filename,
        smallImage: mediaData.small_download_url,
        mediumImage: mediaData.medium_download_url,
        largeImage: mediaData.large_download_url,
        canViewSubmission: mediaData.can_view_submission
      }
    });
    this.loadedMediaCount += medias.length;
  }

  buildMediaDate(mediaData) {
    if (galleryStore.state.filterGroupBy.value === GROUPBY_OPTIONS.question.value) {
      return this.dateCreated;
    } else if (mediaData.submission && mediaData.submission.date_created) {
      return formatTimeDate(mediaData.submission.date_created);
    } else {
      console.error('Unknown media date created', mediaData);
    }
  }

  buildMediaTitle(mediaData, mediaIndex) {
    if (galleryStore.state.filterGroupBy.value === GROUPBY_OPTIONS.question.value) {
      return t('Record ##number##').replace('##number##', parseInt(mediaIndex) + 1);
    } else if (mediaData.question && mediaData.question.label) {
      return mediaData.question.label;
    } else if (this.title) {
      return this.title;
    } else {
      console.error('Unknown media title', mediaData);
    }
  }
}

class SelectedMedia {
  constructor(galleryData, mediaIndex) {
    this.isLoading = true;
    this.data = null;
    this.isFirst = false;
    this.isLast = false;

    if (galleryData instanceof Gallery && typeof mediaIndex !== 'undefined') {
      this.applyData(galleryData, mediaIndex);
    }
  }

  applyData(galleryData, mediaIndex) {
    this.isLoading = false;
    this.data = galleryData.findMedia(mediaIndex);

    this.isFirst = galleryData.galleryIndex === 0 && mediaIndex === 0;

    this.isLast = (
      galleryStore.state.nextGalleriesPageUrl === null &&
      galleryStore.state.galleries.length === galleryData.galleryIndex + 1 &&
      galleryData.totalMediaCount === mediaIndex + 1
    )
  }
}

export const galleryStore = Reflux.initStore(GalleryStore);