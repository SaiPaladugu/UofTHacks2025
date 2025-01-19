import react, { useState, useRef } from "react";
import MyMap from "../components/Map";
import MySearch from "../components/Search";
import Badge from "../components/Badge";
import sampleBadges from "../sampleBadges.json";
import AddScribble from "../components/AddScribble";
import "./Home.css";

const Home = () => {

    const [keywords, setKeywords] = useState([]);
    const [drawingData, setDrawingData] = useState(null);
    const mapRef = useRef();

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

    const handleStartAR = () => {
        console.log("start AR");
        if (mapRef.current && mapRef.current.handleToggleAR) {
            mapRef.current.handleToggleAR();
        }
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
            
            <AddScribble onStartAR={handleStartAR} drawingData={drawingData} />
            <MyMap 
                ref={mapRef} 
                onARComplete={(drawing) => {
                    if (drawing) {
                        console.log("Setting drawing data from AR complete");
                        setDrawingData(drawing);
                    }
                }} 
            />
        </div>
    )
}

export default Home