import React from 'react';
import ReactDOM from 'react-dom';
import Main from './Main';

// ponytail: minimal stub — Extension calls initializeAsync on mount and never
// resolves here, so the smoke test only proves Main renders without throwing.
beforeEach(() => {
  global.tableau = {
    extensions: {
      initializeAsync: () => new Promise(() => {}),
      settings: { get: () => undefined },
    },
  };
});

it('renders without crashing', () => {
  const div = document.createElement('div');
  ReactDOM.render(<Main />, div);
  ReactDOM.unmountComponentAtNode(div);
});
