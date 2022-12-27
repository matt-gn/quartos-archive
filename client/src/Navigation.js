import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { clearSelection } from './modules/annotationViewer'
import { push } from 'react-router-redux';
import { withRouter } from 'react-router';
import AppBar from 'material-ui/AppBar';
import FlatButton from 'material-ui/FlatButton';
import Popover from 'material-ui/Popover';
import Menu from 'material-ui/Menu';
import MenuItem from 'material-ui/MenuItem';
import CircularProgress from 'material-ui/CircularProgress';
import Divider from 'material-ui/Divider';
import DropDownMenu from 'material-ui/DropDownMenu';
import MenuIcon from 'material-ui/svg-icons/navigation/menu';
import MoreVert from 'material-ui/svg-icons/navigation/more-vert';
import IconButton from 'material-ui/IconButton';
import { signOutUser } from './modules/redux-token-auth-config';
import { toggleSidebar } from './modules/project';
import { load, showRegistration, showLogin, toggleAuthMenu, hideAuthMenu, showAdminDialog } from './modules/home';
import { setCurrentLayout, layoutOptions } from './modules/documentGrid';

import LoginRegistrationDialog from './LoginRegistrationDialog';
import AdminDialog from './AdminDialog';

const LoginMenuBody = props => {
  if (props.currentUser 
    && props.currentUser.isSignedIn
    && props.currentUser.attributes
    && props.currentUser.attributes.confirmed) {
    return (
      <div>
        <MenuItem primaryText = 'Sign out' onClick={() => {
          props.signOutUser()
          .then(() => {
            props.clearSelection()
            props.hideAuthMenu();
            if (props.location && props.location.pathname === '/') {
              props.load();
              props.returnHome();
            }
          });
        }} />
        {props.currentUser.attributes.admin &&
          <div>
            <Divider />
            <MenuItem primaryText = 'Admin' onClick={() => {
              props.showAdminDialog();
              props.hideAuthMenu();
            }} />
          </div>
        }
      </div>
    );
  }
  return (
    <div>
      <MenuItem primaryText='Sign in' onClick={props.showLogin} />
      <MenuItem primaryText='Register' onClick={props.showRegistration}/>
    </div>
  )
}

class Navigation extends Component {

  constructor(props) {
    super(props);
    this.state = {
      layoutTooltipOpen: false,
      layoutTooltipAnchor: null,
    };
  }

  onTooltipOpen (e) {
    e.persist();
    const layoutTooltipAnchor = e.currentTarget;
    e.preventDefault();
    this.setState((prevState) => {
      return {
        ...prevState,
        layoutTooltipOpen: true,
        layoutTooltipAnchor,
      }
    });
  }

  onTooltipClose () {
    this.setState((prevState) => {
      return {
        ...prevState,
        layoutTooltipOpen: false,
      }
    });
  }
  onCloseProject = () => {
    this.props.clearSelection()
    this.props.returnHome()
  }

  render() {
    let userMenuLabel = '';
    if (this.props.currentUser 
      && this.props.currentUser.isSignedIn 
      && this.props.currentUser.attributes 
      && this.props.currentUser.attributes.confirmed
    ) { // if a user is signed in
      userMenuLabel += this.props.currentUser.attributes.name;
      if (!this.props.currentUser.attributes.approved) {
        userMenuLabel += ' (Pending approval)';
      }
    }
    return (
      <div>	// NOTE New nav bar logo
        <AppBar
          title={<div>
            <span><img src="/images/archive.png" height="65" width="220"></img></span>
            {this.props.isLoading &&
              <CircularProgress color={'#FFF'} style={{top: '12px', left: '18px'}}/>
            }
          </div>}
          showMenuIconButton={!this.props.isHome}
          iconElementLeft={this.props.isHome ? (<div />) : (
            <IconButton
              onClick={this.props.toggleSidebar}
              tooltip="Expand/collapse sidebar"
              tooltipPosition="bottom-right"
            >
              <MenuIcon color="white" />
            </IconButton>
          )}
          iconElementRight={
            <div style={{ display: 'flex' }}>
              {!this.props.isHome && 
                <div style={{display: 'flex'}}>
                  <DropDownMenu
                    value={this.props.currentLayout}
                    onChange={this.props.setCurrentLayout}
                    style={{ height: '42px' }}
                    labelStyle={{ color: 'white', lineHeight: '50px', height: '30px' }}
                    menuStyle={{ marginTop: '52px' }}
                    onMouseOver={this.onTooltipOpen.bind(this)}
                    onMouseOut={this.onTooltipClose.bind(this)}
                  >
                    {layoutOptions.map((option, index) => (
                      <MenuItem key={index} value={index} primaryText={option.description} />
                    ))}
                  </DropDownMenu>
                </div>
              }
              <FlatButton
                style={{ minWidth: '48px', color: 'white', marginTop: '6px' }}
                icon={<MoreVert />}
                label={userMenuLabel}
                labelPosition='before'
                onClick={event => {this.props.toggleAuthMenu(event.currentTarget);}}
              />
            </div>
          }
          style={{position: 'fixed', top: 0, zIndex: 9999}}
        />
        <Popover
          open={this.props.authMenuShown}
          anchorEl={this.props.authMenuAnchor}
          anchorOrigin={{horizontal: 'right', vertical: 'top'}}
          targetOrigin={{horizontal: 'right', vertical: 'top'}}
          onRequestClose={this.props.hideAuthMenu}
          style={{ marginTop: '52px' }}
        >
          <Menu>
            <LoginMenuBody {...this.props} />
          </Menu>
        </Popover>
        <Popover
          open={this.state.layoutTooltipOpen}
          anchorEl={this.state.layoutTooltipAnchor}
          zDepth={5}
          className="tooltip-popover extra-margin-tooltip"
          anchorOrigin={{horizontal: 'middle', vertical: 'bottom'}}
          targetOrigin={{horizontal: 'middle', vertical: 'top'}}
          useLayerForClickAway={false}
          autoCloseWhenOffScreen={false}
      	>
          Set grid layout
        </Popover>
        <LoginRegistrationDialog />
        <AdminDialog />
      </div>	// NOTE Removed search bar and 'Return to top' button
    )
  }
}

const mapStateToProps = state => ({
  currentUser: state.reduxTokenAuth.currentUser,
  authMenuShown: state.home.authMenuShown,
  authMenuAnchor: state.home.authMenuAnchor,
  currentLayout: state.documentGrid.currentLayout
});

const mapDispatchToProps = dispatch => bindActionCreators({
  returnHome: () => push('/'),
  load,
  showRegistration,
  showLogin,
  toggleAuthMenu,
  hideAuthMenu,
  signOutUser,
  showAdminDialog,
  setCurrentLayout,
  clearSelection,
  toggleSidebar
}, dispatch);

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withRouter((props) => <Navigation {...props} />));
