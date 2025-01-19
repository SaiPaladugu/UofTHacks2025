import react, { useState } from "react";
import MyMap from "../components/Map";
import MySearch from "../components/Search";
import Badge from "../components/Badge";
import sampleBadges from "../sampleBadges.json";
import AddScribble from "../components/AddScribble";
import "./Home.css";

const Home = () => {

    const [keywords, setKeywords] = useState([]);

    const handleSearch = async (query) => {

        setKeywords(sampleBadges.badges);
        // try {
        //     // Replace this with your actual API call
        //     const response = await fetch(`/api/search?q=${query}`);
        //     const data = await response.json();
        //     setKeywords(data.keywords); // Assuming the API returns { keywords: [] }
        // } catch (error) {
        //     console.error("Error fetching keywords:", error);
        //     setKeywords([]); // Clear keywords on error
        // }
    };


    return (
        <div className="home-container">
            <div className="search-badge-container">
                <div className="search-container">
                    <MySearch onSearch={handleSearch} />
                </div>
                {keywords.length > 0 && (
                    <div className="badge-container">
                    <Badge keywords={keywords} />
                    </div>
                )}
         
            </div>
            <AddScribble />
            <MyMap />
            
        </div>
    )
}

export default Home