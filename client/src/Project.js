import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import HTML5Backend from 'react-dnd-html5-backend';
import { DragDropContext } from 'react-dnd';
import { loadProject, updateProject, showSettings, hideSettings, checkInAll } from './modules/project';
import { selectTarget, closeTarget, closeTargetRollover, promoteTarget } from './modules/annotationViewer';
import { openDocument, closeDeleteDialog, confirmDeleteDialog, layoutOptions, updateSnackBar, fetchLock } from './modules/documentGrid';
import { selectHighlight } from './modules/textEditor';
import Dialog from 'material-ui/Dialog';
import Snackbar from 'material-ui/Snackbar';
import FlatButton from 'material-ui/FlatButton';
import Navigation from './Navigation';
import ProjectSettingsDialog from './ProjectSettingsDialog';
import TableOfContents from './TableOfContents';
import DocumentViewer from './DocumentViewer';
import LinkInspectorPopupLayer from './LinkInspectorPopupLayer';
import SearchResultsPopupLayer from './SearchResultsPopupLayer';
import BatchImagePrompt from './BatchImagePrompt';
import { Beforeunload } from 'react-beforeunload';

const rolloverTimeout = 500

class Project extends Component {
  constructor(props) {
    super(props);

    this.mainContainer = null;
    this.mouseX = 0;
    this.mouseY = 0;
    this.rolloverTimer = null;
    this.preload = [];
  }

  setFocusHighlight(document_id, highlight_id, key) {
    this.hideRollover(highlight_id)
    const target = this.createTarget(document_id, highlight_id, key)
    if (target) {
      this.props.selectTarget(target);
    }
  }

  selectTextHighlight(document_id, highlight_id, key) {
    if (!(key && this.props.highlightsHidden && this.props.highlightsHidden[key])) {
      if (this.props.highlightSelectModes[key]) {
        this.props.selectHighlight(key, highlight_id);
      }
      // if the clicked highlight is currently selected, don't proceed with the normal popover behavior to facilitate editing the highlighted text
      else if (this.props.selectedHighlights[key] !== highlight_id) {
        this.setFocusHighlight(document_id, highlight_id, key);
      }
    }
  }

  showRollover(document_id, highlight_id, key) {
    // if this doc's highlights are hidden, or the hovered highlight is currently selected,
    // don't proceed with the normal popover behavior to facilitate editing the highlighted text
    if ((key && this.props.highlightsHidden && this.props.highlightsHidden[key]) || this.props.selectedHighlights[key] === highlight_id) return;
    const existingPopover = this.props.selectedTargets.find(target => !target.rollover && target.uid === highlight_id)
    if (!existingPopover) {
      this.activateRolloverTimer(() => {
        const target = this.createTarget(document_id, highlight_id, key)
        if (target) {
          target.rollover = true
          this.props.selectTarget(target);
        }
        else {
          console.log('tried to show rollover for a non-existent target', document_id, highlight_id);
        }
      })
    }
  }

  hideRollover(highlight_uid) {
    const existingRollover = this.props.selectedTargets.find(target => target.rollover && target.uid === highlight_uid)
    if (existingRollover) {
      this.props.closeTargetRollover(highlight_uid);
    } else {
      this.deactivateRolloverTimer()
    }
  }

  createTarget(documentID, highlightID, key) {
    const resource = this.props.openDocuments.find(resource => resource.id.toString() === documentID.toString());
    const target = resource && highlightID ? resource.highlight_map[highlightID] : resource;
    if (target) {
      let newTarget = { ...target }
      newTarget.document_id = documentID;
      newTarget.originKey = key;
      newTarget.highlight_id = highlightID ? target.id : null;
      newTarget.document_title = resource.title;
      newTarget.document_kind = resource.document_kind;
      newTarget.startPosition = {
        x: Math.min(Math.max(this.mouseX - this.props.sidebarWidth, 0), this.mainContainer.offsetWidth),
        y: this.mouseY + window.scrollY
      };
      return newTarget
    } else {
      return null
    }
  }

  activateRolloverTimer(callback) {
    this.deactivateRolloverTimer()
    this.rolloverTimer = setTimeout(callback, rolloverTimeout)
  }

  deactivateRolloverTimer() {
    if (this.rolloverTimer) {
      clearTimeout(this.rolloverTimer)
      this.rolloverTimer = null
    }
  }

  componentDidMount() {
    window.setFocusHighlight = this.setFocusHighlight.bind(this);
    window.selectTextHighlight = this.selectTextHighlight.bind(this);
    window.showRollover = this.showRollover.bind(this);
    window.hideRollover = this.hideRollover.bind(this);
    let slug = this.props.match.params.slug ? this.props.match.params.slug : '1';
    this.props.loadProject(slug, "title");
    const INTRO_DOC_ID = '8';       // NOTE This loads the intro doc -- change this to load a different doc
    this.preload = this.props.match.params.loadIDs ? this.props.match.params.loadIDs.split('+') : [INTRO_DOC_ID];
  }

  preloadDocs() {
    const { openDocumentIds } = this.props;
    if (this.preload.length > 0 && openDocumentIds.length === 0) {
      for (let i = 0; i < this.preload.length; i++) {
        this.props.openDocument(this.preload[i], null, true, i + 1);
      }
    }
    this.preload = [];
  }

  componentDidUpdate(prevProps) {
    if (prevProps.currentUser !== this.props.currentUser && this.props.match.params.slug !== 'new') {
      this.props.loadProject(this.props.match.params.slug, this.props.projectTitle);
      this.props.openDocumentIds.forEach((id) => {
        this.props.fetchLock(id);
      });
    }
  }

  renderDeleteDialog() {
    const { deleteDialogTitle, closeDeleteDialog, deleteDialogSubmit, deleteDialogOpen, deleteDialogBody, confirmDeleteDialog } = this.props;
    return (
      <Dialog
        title={deleteDialogTitle}
        actions={[
          <FlatButton label='Cancel' primary={true} onClick={closeDeleteDialog} />,
          <FlatButton label={deleteDialogSubmit} primary={true} onClick={confirmDeleteDialog} />
        ]}
        modal={true}
        open={deleteDialogOpen}
      >
        {deleteDialogBody}
      </Dialog>
    );
  }

  renderDialogLayers() {
    return (
      <div>
        <LinkInspectorPopupLayer
          targets={this.props.selectedTargets}
          closeHandler={this.props.closeTarget}
          mouseDownHandler={this.props.promoteTarget}
          openDocuments={this.props.openDocuments}
          openDocumentIds={this.props.openDocumentIds}
          writeEnabled={this.props.writeEnabled}
          adminEnabled={this.props.adminEnabled}
          sidebarWidth={this.props.sidebarWidth}
        />
        <SearchResultsPopupLayer
          openDocumentIds={this.props.openDocumentIds}
          sidebarWidth={this.props.sidebarWidth}
        />
        {this.renderDeleteDialog()}
        <ProjectSettingsDialog />
        <BatchImagePrompt />
      </div>
    );
  }

  getSelectedHighlight(key) {
    return this.props.selectedHighlights[key];
  }

  renderDocumentViewer = (document, index) => {
    const { projectId, writeEnabled } = this.props;
    const key = `${document.id}-${document.timeOpened}`;
    return (
      <DocumentViewer
        key={key}
        index={index}
        projectId={projectId}
        document_id={document.id}
        timeOpened={document.timeOpened}
        resourceName={document.title}
        document_kind={document.document_kind}
        content={document.content}
        highlight_map={document.highlight_map}
        getHighlightMap={function () { return document.highlight_map; }}
        image_thumbnail_urls={document.image_thumbnail_urls}
        image_urls={document.image_urls}
        linkInspectorAnchorClick={() => { this.setFocusHighlight(document.id, undefined, key); }}
        writeEnabled={writeEnabled}
        locked={document.locked}
        lockedByUserName={document.locked_by_user_name}
        lockedByMe={document.locked_by_me}
        numRows={this.numRows}
        firstTarget={document.firstTarget}
        getSelectedHighlight={this.getSelectedHighlight.bind(this)}
      />
    );
  }

  renderDocumentGrid() {
    const { currentLayout, openDocuments } = this.props;
    const newNumRows = Math.max(1, Math.ceil(openDocuments.length / currentLayout.cols));

    // if the number of rows goes up, bump the scroll bar
    if (this.numRows && newNumRows > currentLayout.rows && newNumRows > this.numRows) {
      const newScrollPos = 100 + window.pageYOffset;
      window.scrollTo(0, newScrollPos);
    }
    this.numRows = newNumRows;

    const gridInnerStyle = {
      margin: `72px 8px 0 ${this.props.sidebarWidth + 8}px`,
      display: 'flex',
      flexWrap: 'wrap',
      overflow: 'hidden'
    }
    return (
      <div
        id='document-grid-main'
        ref={el => { this.mainContainer = el; }}
        onMouseMove={event => { this.mouseX = event.clientX; this.mouseY = event.clientY; }}
      >
        <div
          id='document-grid-inner'
          style={gridInnerStyle}
        >
          {openDocuments.map(this.renderDocumentViewer)}
        </div>
      </div>
    );
  }

  renderSnackbar() {
    const { snackBarMessage, snackBarOpen, updateSnackBar } = this.props
    return (
      <Snackbar
        open={snackBarOpen}
        message={snackBarMessage ? snackBarMessage : ""}
        autoHideDuration={2000}
        onRequestClose={() => { updateSnackBar(false, null) }}
      />
    )
  }

  render() {
    const {
      title,
      projectId,
      loading,
      adminEnabled,
      sidebarWidth,
      contentsChildren,
      openDocumentIds,
      writeEnabled,
      uploads,
      uploading,
      batchImagePromptShown,
    } = this.props;
    const uploadsNotDone = uploads.some(
      (upload) => upload.state !== 'finished' && upload.state !== 'error'
    );
    return (
      <div>
        <Navigation
          title={title}
          openDocumentIds={openDocumentIds}
          inputId={projectId}
          onTitleChange={(event, newValue) => { this.props.updateProject(projectId, { title: newValue }); }}
          isLoading={loading}
        />
        <TableOfContents
          adminEnabled={adminEnabled}
          settingsClick={this.props.showSettings}
          checkInAllClick={() => this.props.checkInAll(projectId)}
          sidebarWidth={sidebarWidth}
          contentsChildren={contentsChildren}
          openDocumentIds={openDocumentIds}
          writeEnabled={writeEnabled}
        />
        {this.renderDialogLayers()}
        {this.renderDocumentGrid()}
        {this.renderSnackbar()}
        {this.preloadDocs()}
        {(loading ||
          (
            uploads &&
            uploads.length > 0 &&
            uploadsNotDone
          ) ||
          uploading ||
          batchImagePromptShown)
          && (
            <Beforeunload onBeforeunload={(event) => event.preventDefault()} />
          )}
      </div>
    );
  }
}

const mapStateToProps = state => ({
  currentUser: state.reduxTokenAuth.currentUser,
  projectId: state.project.id,
  title: state.project.title,
  loading: state.project.loading,
  errored: state.project.errored,
  adminUsers: state.project.adminUsers,
  contentsChildren: state.project.contentsChildren,
  sidebarWidth: state.project.sidebarWidth,
  sidebarIsDragging: state.project.sidebarIsDragging,
  uploads: state.project.uploads,
  uploading: state.project.uploading,
  batchImagePromptShown: state.project.batchImagePromptShown,
  writeEnabled: state.project.currentUserPermissions.write,
  adminEnabled: state.project.currentUserPermissions.admin,
  openDocuments: state.documentGrid.openDocuments,
  openDocumentIds: state.documentGrid.openDocuments.map(document => document.id.toString()),
  deleteDialogOpen: state.documentGrid.deleteDialogOpen,
  deleteDialogTitle: state.documentGrid.deleteDialogTitle,
  deleteDialogBody: state.documentGrid.deleteDialogBody,
  deleteDialogSubmit: state.documentGrid.deleteDialogSubmit,
  snackBarOpen: state.documentGrid.snackBarOpen,
  snackBarMessage: state.documentGrid.snackBarMessage,
  currentLayout: layoutOptions[state.documentGrid.currentLayout],
  selectedTargets: state.annotationViewer.selectedTargets,
  sidebarTarget: state.annotationViewer.sidebarTarget,
  highlightSelectModes: state.textEditor.highlightSelectModes,
  selectedHighlights: state.textEditor.selectedHighlights,
  highlightsHidden: state.textEditor.highlightsHidden,
});

const mapDispatchToProps = dispatch => bindActionCreators({
  loadProject,
  updateProject,
  selectTarget,
  closeTarget,
  closeTargetRollover,
  promoteTarget,
  openDocument,
  closeDeleteDialog,
  confirmDeleteDialog,
  showSettings,
  checkInAll,
  updateSnackBar,
  hideSettings,
  selectHighlight,
  fetchLock,
}, dispatch);

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(DragDropContext(HTML5Backend)(Project));
