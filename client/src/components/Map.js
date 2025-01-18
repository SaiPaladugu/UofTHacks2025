import React, { useState } from 'react';
import ReactMapGL, { Marker, Popup } from 'react-map-gl';
import mapboxgl from 'mapbox-gl'
import { useRef, useEffect } from 'react';

const MyMap = () => {

    const mapRef = useRef()
    const mapContainerRef = useRef()

    useEffect(() => {
        mapboxgl.accessToken = 'pk.eyJ1Ijoic2FpcGFsYWR1Z3UiLCJhIjoiY202MmxmMTA4MTRnYTJqb3A3dGh1ajc0ayJ9.yct_mqWxLmGeEmr86O7ezA'
        mapRef.current = new mapboxgl.Map({
            container: mapContainerRef.current,
        });

        return () => {
            mapRef.current.remove()
        }
    }, [])

    return (
        <div style={{ width: '100vw', height: '100vh' }}>
            <div id='map-container' style={{ width: '100%', height: '100%' }} ref={mapContainerRef} />

        </div>
    );
};

export default MyMap;
