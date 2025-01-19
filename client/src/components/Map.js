import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MyMap = () => {
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

    // Keep track of current Marker objects so we can remove them
    const markersRef = useRef([]);

    // For the <video> element
    const videoRef = useRef(null);

    // 1. Initialize Mapbox
    // 1. Initialize Mapbox
    useEffect(() => {
        mapboxgl.accessToken = 'pk.eyJ1Ijoic2FpcGFsYWR1Z3UiLCJhIjoiY202MmxmMTA4MTRnYTJqb3A3dGh1ajc0ayJ9.yct_mqWxLmGeEmr86O7ezA'

        if (isARActive) {
            return;
        }

        const map = new mapboxgl.Map({
            container: mapContainerRef.current,
            center: [-74.0060152, 40.7127281], // Default center
            zoom: 29,
            pitch: 74,
            bearing: 12.8,
            hash: true,
            style: 'mapbox://styles/mapbox/standard',
            projection: 'globe',
        });

        mapRef.current = map;

        // Add a sample layer when style is loaded
        map.on('style.load', () => {
            // map.addSource('urban-areas', {
            //     type: 'geojson',
            //     data: 'https://docs.mapbox.com/mapbox-gl-js/assets/ne_50m_urban_areas.geojson',
            // });

            map.addSource('urban-areas', {
                type: 'geojson',
                data: 'https://docs.mapbox.com/mapbox-gl-js/assets/ne_50m_urban_areas.geojson'
            });

            map.addLayer({
                id: 'urban-areas-fill',
                type: 'fill',
                source: 'urban-areas',
                layout: {},
                paint: {
                    'fill-color': '#f08',
                    'fill-opacity': 0.4,
                },
            });

            // Zoom into the user's location if available
            if (userLocation) {
                map.flyTo({
                    center: [userLocation.lng, userLocation.lat],
                    zoom: 14, // Adjust zoom level as needed
                    essential: true // This animation is considered essential with respect to prefers-reduced-motion
                });
            }
        });

        // Cleanup on unmount
        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
            }
        };
    }, [isARActive, userLocation]); // Add userLocation as a dependency

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
        if (!ctx) return;
        setIsDrawing(true);
        ctx.beginPath();
        ctx.moveTo(e.clientX, e.clientY);
    };

    const handleMouseMove = (e) => {
        if (!isDrawing || !ctx) return;
        ctx.lineTo(e.clientX, e.clientY);
        ctx.stroke();
    };

    const handleMouseUp = () => {
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
            // Request camera + geolocation
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' },
                });
                setVideoStream(stream);

                // Get location
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        const location = {
                            lat: pos.coords.latitude,
                            lng: pos.coords.longitude,
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
        } else {
            // Exiting AR mode: capture drawing & add it to arDrawings
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
                    <button
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
                    </button>
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
                    {/* Button to start AR */}
                    <button
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
                        Start AR
                    </button>
                </>
            )}
        </div>
    );
};

export default MyMap;
