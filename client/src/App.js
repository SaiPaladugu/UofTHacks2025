import logo from './logo.svg';
import './App.css';
import Routers from './Routers';
import { useContext, createContext } from 'react';

const ThemeContext = createContext();
function App() {
  return (
    <ThemeContext.Provider>
      <Routers />
    </ThemeContext.Provider>
  );
}

export default App;
