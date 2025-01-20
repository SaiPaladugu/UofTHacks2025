import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MyMap = forwardRef((props, ref) => {
    // Refs for Mapbox
    const mapRef = useRef(null);
    const mapContainerRef = useRef(null);

    // AR-related state
    const [isARActive, setIsARActive] = useState(false);
    const [videoStream, setVideoStream] = useState(null);
    const [userLocation, setUserLocation] = useState(null);

    // Canvas drawing
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [ctx, setCtx] = useState(null);

    // Store the drawings as an array of { lat, lng, imageData }
    const [arDrawings, setArDrawings] = useState([]);

    // To transform search results to map coordinates
    const [heatmapData, setHeatmapData] = useState(null);

    // Keep track of current Marker objects so we can remove them
    const markersRef = useRef([]);

    // For the <video> element
    const videoRef = useRef(null);

    
    // Expose handleToggleAR to parent components through ref
    useImperativeHandle(ref, () => ({
        handleToggleAR: async () => {
            if (!isARActive) {
                // Starting AR mode
                try {
                    await startCamera();
                    return null;
                } catch (error) {
                    console.error('Error starting AR:', error);
                    return null;
                }
            } else {
                // Stopping AR mode
                const drawingImageData = saveDrawingImage();
                if (drawingImageData && userLocation) {
                    setArDrawings((prev) => [
                        ...prev,
                        {
                            lat: userLocation.lat,
                            lng: userLocation.lng,
                            imageData: drawingImageData,
                        },
                    ]);

                    // Stop video tracks
                    if (videoStream) {
                        videoStream.getTracks().forEach((track) => track.stop());
                    }
                    setVideoStream(null);
                    setIsARActive(false);
                    
                    // Immediately call the callback with the drawing data
                    props.onARComplete?.(drawingImageData);
                    return drawingImageData;
                }
            }
        },
        updateHeatmap: (searchResults) => {
            console.log("updateHeatmap - searchResults:", searchResults);
            const geoJSON = transformToGeoJSON(searchResults);
            setHeatmapData(geoJSON);
        }
    }));

    // Add function to transform search results
    const transformToGeoJSON = (searchResults) => {
        // Extract the results array from the response
        const results = searchResults.results || [];
        const payload = {
            type: "FeatureCollection",
            crs: { 
                type: "name", 
                properties: { 
                    name: "urn:ogc:def:crs:OGC:1.3:CRS84" 
                } 
            },
            features: results.map((result, index) => ({
                type: "Feature",
                properties: {
                    id: result.scribbleId || `result${index}`,
                    mag: 2.5,
                    time: new Date(result.createdAt).getTime(),
                    felt: null,
                    tsunami: 0
                },
                geometry: {
                    type: "Point",
                    coordinates: [
                        Number(result.coordinates.longitude),
                        Number(result.coordinates.latitude),
                        0.0
                    ]
                }
            }))
        };
        console.log("payload", payload);
        return payload;
    };

    // 1. Initialize Mapbox
    useEffect(() => {
        mapboxgl.accessToken = 'pk.eyJ1Ijoic2FpcGFsYWR1Z3UiLCJhIjoiY202MmxmMTA4MTRnYTJqb3A3dGh1ajc0ayJ9.yct_mqWxLmGeEmr86O7ezA';
    
        if (isARActive) {
            return;
        }
    
        mapRef.current = new mapboxgl.Map({
            container: mapContainerRef.current,
            zoom: 16.8,
            center: [24.951528, 60.169573],
            pitch: 74,
            bearing: 12.8,
            hash: true,
            style: 'mapbox://styles/mapbox/streets-v11', // Use a valid Mapbox style
            projection: 'globe'
        });
    

        mapRef.current.on('load', () => {
            mapRef.current.addSource('earthquakes', {
                type: 'geojson',
                data: heatmapData
            });
        
            // Add heatmap layer
            mapRef.current.addLayer(
                {
                    id: 'earthquakes-heat',
                    type: 'heatmap',
                    source: 'earthquakes',
                    maxzoom: 9,
                    paint: {
                        'heatmap-weight': [
                            'interpolate',
                            ['linear'],
                            ['get', 'mag'],
                            0,
                            0,
                            6,
                            1
                        ],
                        'heatmap-intensity': [
                            'interpolate',
                            ['linear'],
                            ['zoom'],
                            0,
                            1,
                            9,
                            3
                        ],
                        'heatmap-color': [
                            'interpolate',
                            ['linear'],
                            ['heatmap-density'],
                            0,
                            'rgba(33,102,172,0)',
                            0.2,
                            'rgb(103,169,207)',
                            0.4,
                            'rgb(209,229,240)',
                            0.6,
                            'rgb(253,219,199)',
                            0.8,
                            'rgb(239,138,98)',
                            1,
                            'rgb(178,24,43)'
                        ],
                        'heatmap-radius': [
                            'interpolate',
                            ['linear'],
                            ['zoom'],
                            0,
                            2,
                            9,
                            20
                        ],
                        'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 7, 1, 9, 0]
                    }
                },
                'waterway-label'
            );
        
            // Add point layer
            mapRef.current.addLayer(
                {
                    id: 'earthquakes-point',
                    type: 'circle',
                    source: 'earthquakes',
                    minzoom: 7,
                    paint: {
                        'circle-radius': [
                            'interpolate',
                            ['linear'],
                            ['zoom'],
                            7,
                            ['interpolate', ['linear'], ['get', 'mag'], 1, 1, 6, 4],
                            16,
                            ['interpolate', ['linear'], ['get', 'mag'], 1, 5, 6, 50]
                        ],
                        'circle-color': [
                            'interpolate',
                            ['linear'],
                            ['get', 'mag'],
                            1,
                            'rgba(33,102,172,0)',
                            2,
                            'rgb(103,169,207)',
                            3,
                            'rgb(209,229,240)',
                            4,
                            'rgb(253,219,199)',
                            5,
                            'rgb(239,138,98)',
                            6,
                            'rgb(178,24,43)'
                        ],
                        'circle-stroke-color': 'white',
                        'circle-stroke-width': 1,
                        'circle-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0, 8, 1]
                    }
                },
                'waterway-label'
            );
        
            // Add 3D buildings
            mapRef.current.addLayer(
                {
                    id: '3d-buildings',
                    source: 'composite',
                    'source-layer': 'building',
                    filter: ['==', 'extrude', 'true'],
                    type: 'fill-extrusion',
                    minzoom: 15,
                    paint: {
                        'fill-extrusion-color': '#aaa',
                        'fill-extrusion-height': [
                            'interpolate',
                            ['linear'],
                            ['zoom'],
                            15,
                            0,
                            16.05,
                            ['get', 'height']
                        ],
                        'fill-extrusion-base': [
                            'interpolate',
                            ['linear'],
                            ['zoom'],
                            15,
                            0,
                            16.05,
                            ['get', 'min_height']
                        ],
                        'fill-extrusion-opacity': 0.6
                    }
                },
                'waterway-label'
            );

            // Add source update listener
            if (mapRef.current && heatmapData) {
                const source = mapRef.current.getSource('earthquakes');
                if (source) {
                    source.setData(heatmapData);
                }
            }
        });
        
    
        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
            }
        };
    }, [isARActive, heatmapData]);
    

    // 2. Each time arDrawings changes, remove old markers, add new ones
    useEffect(() => {
        if (!mapRef.current) return;
        const map = mapRef.current;

        // Remove existing markers
        markersRef.current.forEach((marker) => marker.remove());
        markersRef.current = [];

        // Add new markers
        arDrawings.forEach((drawing, index) => {
            const markerEl = document.createElement('div');
            markerEl.style.width = '20px';
            markerEl.style.height = '20px';
            markerEl.style.background = 'red';
            markerEl.style.borderRadius = '50%';

            const marker = new mapboxgl.Marker(markerEl)
                .setLngLat([drawing.lng, drawing.lat])
                .addTo(map);

            // Popup for the drawing image
            const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(
                `<div style="text-align:center;">
          <h4>AR Drawing</h4>
          <img src="${drawing.imageData}" alt="AR Drawing" 
               style="max-width:200px; border:1px solid #ccc;" />
        </div>`
            );
            marker.setPopup(popup);

            markersRef.current.push(marker);
        });
    }, [arDrawings]);

    // 3. Attach or detach the camera feed to/from the <video> element
    useEffect(() => {
        if (videoRef.current && videoStream) {
            videoRef.current.srcObject = videoStream;
        }
    }, [videoStream]);

    // 4. Setup the AR canvas context once it's rendered
    useEffect(() => {
        console.log("canvas ref");
        if (!canvasRef.current || !isARActive) return;

        const canvas = canvasRef.current;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const context = canvas.getContext('2d');
        context.lineWidth = 3;
        context.lineCap = 'round';
        context.strokeStyle = '#ff0000';

        setCtx(context);

        // Handle window resizing
        const handleResize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', handleResize);

        return () => window.removeEventListener('resize', handleResize);
    }, [isARActive]);

    // 5. Mouse events for drawing on the canvas
    const handleMouseDown = (e) => {
        console.log("mouse down");
        if (!ctx) return;
        setIsDrawing(true);
        ctx.beginPath();
        ctx.moveTo(e.clientX, e.clientY);
    };

    const handleMouseMove = (e) => {
        console.log("mouse move");
        if (!isDrawing || !ctx) return;
        ctx.lineTo(e.clientX, e.clientY);
        ctx.stroke();
    };

    const handleMouseUp = () => {
        console.log("mouse up");
        setIsDrawing(false);
    };

    // 6. Helper to save the current canvas drawing as an image
    const saveDrawingImage = () => {
        if (!canvasRef.current) return null;
        return canvasRef.current.toDataURL('image/png');
    };

    // 7. Toggles AR on/off
    const handleToggleAR = async () => {
        if (!isARActive) {
            // Check for camera permission
            try {
                const permissionStatus = await navigator.permissions.query({ name: 'camera' });
                
                if (permissionStatus.state === 'granted') {
                    // Permission is already granted, proceed to get the video stream
                    await startCamera();
                } else if (permissionStatus.state === 'prompt') {
                    // Request camera access
                    await startCamera();
                } else {
                    console.error('Camera permission denied');
                }
            } catch (error) {
                console.error('Error checking camera permissions:', error);
            }
        } else {
            // Exiting AR mode: capture drawing & add it to arDrawings
            console.log("Exiting AR mode");
            const drawingImageData = saveDrawingImage();
            if (drawingImageData && userLocation) {
                setArDrawings((prev) => [
                    ...prev,
                    {
                        lat: userLocation.lat,
                        lng: userLocation.lng,
                        imageData: drawingImageData,
                    },
                ]);
            }
    
            // Turn AR off: stop video tracks
            if (videoStream) {
                videoStream.getTracks().forEach((track) => track.stop());
            }
            setVideoStream(null);
            setIsARActive(false);
            
            // Return the drawing data URL directly
            console.log("Returning drawing data URL:", drawingImageData);
            return drawingImageData;
        }
    };
    
    // Helper function to start the camera
    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' },
            });
            setVideoStream(stream);
    
            // Get location
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const location = {
                        lat: 43.6422,
                        lng: -79.3866
                    };
                    setUserLocation(location);
                    console.log('User Location:', location); // Print the location to the console
                },
                (err) => console.error('Error getting location:', err),
                { enableHighAccuracy: true }
            );
    
            // Switch to AR mode
            setIsARActive(true);
        } catch (error) {
            console.error('Error accessing camera:', error);
        }
    };

    // 8. Render
    return (
        <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
            {isARActive ? (
                // ---- AR Mode ----
                <>
                    {/* Camera feed */}
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            zIndex: 0,
                        }}
                    />
                    {/* Canvas for drawing */}
                    <canvas
                        ref={canvasRef}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            zIndex: 1,
                            pointerEvents: 'auto',
                        }}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                    />
                    {/* Button to stop AR */}
                    {/* <button
                        onClick={handleToggleAR}
                        style={{
                            position: 'absolute',
                            bottom: '20px',
                            right: '20px',
                            zIndex: 999,
                            padding: '10px 15px',
                            cursor: 'pointer',
                            fontSize: '16px',
                        }}
                    >
                        Stop AR
                    </button> */}
                </>
            ) : (
                // ---- Map Mode ----
                <>
                    <div
                        id="map-container"
                        ref={mapContainerRef}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            zIndex: 1,
                        }}
                    />
                    {/* Button to start AR
                    <button
                        onClick={handleToggleAR}
                        style={{
                            position: 'absolute',
                            bottom: '100px',
                            right: '20px',
                            zIndex: 999,
                            padding: '10px 15px',
                            cursor: 'pointer',
                            fontSize: '16px',
                        }}
                    >
                        Start AR
                    </button> */}
                </>
            )}
        </div>
    );
});

export default MyMap;
