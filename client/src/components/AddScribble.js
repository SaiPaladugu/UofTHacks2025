import React, { useState } from 'react';
import Modal from './Modal';

const AddScribble = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newPost, setNewPost] = useState({
        text: '',
        image: null
    });

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            setNewPost(prev => ({...prev, image: file}));
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        // Handle the submission logic here
        console.log('Submitted:', newPost);
        setIsModalOpen(false);
        setNewPost({ text: '', image: null });
    };

    return (
        <>
            {/* Plus Button */}
            <button
                onClick={() => setIsModalOpen(true)}
                className="fixed bottom-6 right-6 w-14 h-14 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-blue-600 transition-colors z-[1001]"
                style={{ zIndex: 9999 }}
            >
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
            </button>

            {/* Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            Text
                        </label>
                        <textarea
                            value={newPost.text}
                            onChange={(e) => setNewPost(prev => ({...prev, text: e.target.value}))}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            rows="4"
                            placeholder="Write your post..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            Image
                        </label>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
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
        </>
    );
};

export default AddScribble;