import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import axios from 'axios';

const AddScribble = ({ onStartAR, drawingData }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isARMode, setIsARMode] = useState(false);
    const [newPost, setNewPost] = useState({
        text: '',
        image: null,
        drawingData: null,
        latitude: null,
        longitude: null
    });

    const handlePlusClick = () => {
        console.log("plus clicked");
        setIsARMode(true);
        onStartAR();
    };

    // Add this effect to handle drawing data updates
    useEffect(() => {
        if (drawingData) {
            setNewPost(prev => ({ ...prev, drawingData: drawingData }));
            setIsModalOpen(true);
            setIsARMode(false);
        }
    }, [drawingData]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        // Handle the submission logic here
        console.log("coordinates", newPost.coordinates);
        try {


            const payload = {
                text: newPost.text,
                imageUrl: newPost.drawingData,
                coordinates: {
                    latitude: null,
                    longitude: null
                }
            };

            // Get current position
            if ("geolocation" in navigator) {
                const position = await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject);
                });

                payload.coordinates.latitude = position.coords.latitude;
                payload.coordinates.longitude = position.coords.longitude;
            }

            console.log("payload", payload);
            
            const response = await fetch('http://100.67.210.153:5000/scribble/upload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error('Failed to create post');
            }

            const data = await response.json();
            console.log('Post created successfully:', data);
        } catch (error) {
            console.error('Error creating post:', error);
        } finally {
            // Reset form and close modal
            setIsModalOpen(false);
            setNewPost({ text: '', image: null, drawingData: null });
        }
    };

    // Don't show the button when modal is open
    if (isModalOpen) return (
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
            <form onSubmit={handleSubmit} className="space-y-4">
                {drawingData && (
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700">
                            Your Drawing
                        </label>
                        <img
                            src={drawingData}
                            alt="Your drawing"
                            className="mt-2 rounded-lg border border-gray-200"
                        />
                    </div>
                )}
                <div>
                    <label className="block text-sm font-medium text-gray-700">
                        Text
                    </label>
                    <textarea
                        value={newPost.text}
                        onChange={(e) => setNewPost(prev => ({ ...prev, text: e.target.value }))}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        rows="4"
                        placeholder="Write your post..."
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">
                        Additional Image (Optional)
                    </label>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                                setNewPost(prev => ({ ...prev, image: file }));
                            }
                        }}
                        className="mt-1 block w-full text-sm text-gray-500
                            file:mr-4 file:py-2 file:px-4
                            file:rounded-full file:border-0
                            file:text-sm file:font-semibold
                            file:bg-blue-50 file:text-blue-700
                            hover:file:bg-blue-100"
                    />
                </div>
                <div className="flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={() => setIsModalOpen(false)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600"
                    >
                        Submit
                    </button>
                </div>
            </form>
        </Modal>
    );

    return (
        <>
            {/* Plus/Stop Button */}
            <button
                onClick={handlePlusClick}
                className="fixed bottom-6 right-6 w-14 h-14 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-blue-600 transition-colors z-[1001]"
                style={{ zIndex: 9999 }}
            >
                {isARMode ? (
                    // Stop AR icon/text
                    <span className="text-sm font-medium">Stop AR</span>
                ) : (
                    // Plus icon
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        className="w-8 h-8"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 4v16m8-8H4"
                        />
                    </svg>
                )}
            </button>
        </>
    );
};

export default AddScribble;