import React, { Component }  from 'react';
import Extension from '../components/Extension/Extension';
import Configure from '../components/Configure/Configure';
import DesktopExport from '../components/DesktopExport/DesktopExport';
import './Main.css';

// Strips a trailing slash and/or "index.html" so "/configure", "/configure/"
// and "/configure/index.html" all compare equal - the deployed site serves
// copies of index.html inside those folders.
export const normalizePath = (pathname) => pathname.replace(/(\/index\.html)?\/*$/, '');

class Main extends Component {

  constructor(props) {
    console.log('[Main.js] new constructor');
    super(props);
    this.state = {
      meta : undefined,
      metaVersion: 2,
      button: {
        label : 'Export All',
        style: 'outline',
        disabled : true
      },
      isLoading: false,
      filename: 'ExportAll',
      settingsChanged: false,
    };
    console.log('[Main.js] state initialised', this.state);
  }

  componentWillMount () {
    console.log('[Main.js] componentWillMount');
  }

  componentDidMount() {
    console.log('[Main.js] componentDidMount');
  }

  metaVersionChangedHandler = (version) => {
    console.log(`[Main.js] Updating meta version to ${version}`);
    this.setState({metaVersion: version});
  }

  labelChangedHandler = (labelTxt) => {
    console.log(`[Main.js] Updating label text to ${labelTxt}`);
    const button = {...this.state.button, label: labelTxt};
    this.setState({button});
  }

  filenameChangedHandler = (filename) => {
    console.log(`[Main.js] Updating filename to ${JSON.parse(filename)}`);
    this.setState({filename: JSON.parse(filename)});
  }

  buttonStateChangedHandler = (disabled) => {
    console.log(`[Main.js] Changing button state to ${disabled}`);
    const button = {...this.state.button, disabled};
    this.setState({button});
  }

  buttonStyleChangedHandler = (style) => {
    console.log(`[Main.js] Changing button style to ${style}`);
    const button = {...this.state.button, style: JSON.parse(style)};
    this.setState({button});
  }

  metaChangedHandler = (newSettings) => {
    console.log('[Main.js] Meta changed', newSettings);
    this.setState({meta: newSettings});
  }

  settingsChangedHandler = (state) => {
    console.log('[Main.js] Settings changed', state);
    this.setState({settingsChanged: state});
  }

  resetSettingsHandler = () => {
    console.log('[Main.js] Reset Settings');
    this.setState({
      meta : undefined,
      metaVersion: 2,
      button: {
        label : 'Export All',
        style: 'outline',
        disabled : true
      },
      isLoading: false,
      filename: 'ExportAll',
      settingsChanged: false,
    });
  }

  renderExtension = () => {
    return (
      <Extension 
        label={this.state.button.label} 
        meta={this.state.meta}
        metaVersion={this.state.metaVersion}
        style={this.state.button.style} 
        filename={this.state.filename} 
        disabled={this.state.button.disabled} 
        updateMetaVersion={this.metaVersionChangedHandler}
        updateMeta={this.metaChangedHandler} 
        disableButton={this.buttonStateChangedHandler} 
        updateLabel={this.labelChangedHandler}  
        updateButtonStyle={this.buttonStyleChangedHandler} 
        updateFilename={this.filenameChangedHandler} />
    )
  }

  renderConfigure = () => {
    return (
      <Configure 
        label={this.state.button.label} 
        meta={this.state.meta} 
        style={this.state.button.style} 
        filename={this.state.filename} 
        enableSave={this.state.settingsChanged} 
        updateMeta={this.metaChangedHandler} 
        disableButton={this.buttonStateChangedHandler} 
        updateLabel={this.labelChangedHandler} 
        changeSettings={this.settingsChangedHandler} 
        updateButtonStyle={this.buttonStyleChangedHandler} 
        updateFilename={this.filenameChangedHandler} 
        resetSettings={this.resetSettingsHandler}/>
    )
  }

  renderDesktopExport = () => {
    return (
      <DesktopExport />
    )
  }

  render() {
    // Static routing: each view is a separate browser context, so the pathname
    // is fixed for the lifetime of the page - no router needed.
    const viewPath = normalizePath(window.location.pathname);
    console.log(`[Main.js] Rendering view for path ${viewPath}`);
    if (viewPath.endsWith('/configure')) return this.renderConfigure();
    if (viewPath.endsWith('/desktopexport')) return this.renderDesktopExport();
    return this.renderExtension();
  }
}

export default Main;
