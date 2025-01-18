import react from "react";
import MyMap from "../components/Map";
import MySearch from "../components/Search";
import "./Home.css";
const Home = () => {
    return (
        <div className="home-container">
            <div className="search-container">
                <MySearch />
            </div>
            <MyMap />
        </div>
    )
}

export default Home