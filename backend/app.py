import math
from math import radians, sin, cos, asin, sqrt
from flask import Flask, request, jsonify
import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv
import traceback  # for detailed error tracebacks
from groq import Groq
from flask_cors import CORS
import os
import google.generativeai as genai
import json
import cohere

app = Flask(__name__)

# -------------------------------------------------------------------
# 0) Cors Nonsense
# -------------------------------------------------------------------
CORS(app, resources={r"/*": {"origins": "*"}},
     allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
     expose_headers="*",
     supports_credentials=True,
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"])

# -------------------------------------------------------------------
# 1) Initialize Firebase Admin & Badges Array
# -------------------------------------------------------------------
try:
    cred = credentials.Certificate('serviceAccountKey.json')
    firebase_admin.initialize_app(cred)
    db = firestore.client()
except Exception as e:
    print("Error initializing Firebase Admin:")
    traceback.print_exc()

badges = []

# -------------------------------------------------------------------
# 2) Configure environment for Groq & Gemini & Cohere
# -------------------------------------------------------------------
load_dotenv()  # Loads variables from .env

COHERE_API_KEY = os.getenv("COHERE_API_KEY")
cohere_client = cohere.Client(COHERE_API_KEY)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
    except Exception as e:
        print("Error configuring Gemini API:")
        traceback.print_exc()

try:
    client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    client = Groq()  # Re-initialize to ensure a fresh client context
except Exception as e:
    print("Error initializing Groq client:")
    traceback.print_exc()

# -------------------------------------------------------------------
# 3) Utility Functions
# -------------------------------------------------------------------
def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371000
    dLat = radians(lat2 - lat1)
    dLon = radians(lon2 - lon1)
    a = (sin(dLat/2)**2) + cos(radians(lat1)) * cos(radians(lat2)) * (sin(dLon/2)**2)
    c = 2 * asin(sqrt(a))
    return R * c

def extract_json_from_response(response_text):
    """
    Extracts and validates JSON content from the LLM response text, handling backticks, titles, and extraneous text.

    Args:
        response_text (str): The raw response text from the LLM.

    Returns:
        dict: Parsed JSON object if valid, or an empty dictionary otherwise.
    """
    import re  # Regular expressions for cleaning up the response

    try:
        # Step 1: Remove any surrounding whitespace
        response_text = response_text.strip()

        # Step 2: Handle backticks and titles like "json"
        # Match the JSON part within backticks or standalone JSON block
        json_match = re.search(r"```json\s*(\{.*\})\s*```|(\{.*\})", response_text, re.DOTALL)

        if json_match:
            # Extract the JSON part (either group 1 or 2 based on match)
            response_text = json_match.group(1) or json_match.group(2)

        # Step 3: Validate and parse the JSON
        if response_text.startswith("{") and response_text.endswith("}"):
            return json.loads(response_text)
        else:
            print("Response does not contain valid JSON:", response_text)
            return {}

    except json.JSONDecodeError as jde:
        print("JSONDecodeError while parsing response:", jde)
        print("Invalid JSON response:", response_text)
        return {}
    except Exception as e:
        print("Unexpected error while extracting JSON:", e)
        traceback.print_exc()
        return {}

def call_cohere_similarity(query, texts):
    """
    Calls Cohere to calculate semantic similarity between the query and texts.

    Args:
        query (str): The search query.
        texts (list of str): List of texts to compare against the query.

    Returns:
        list of float: Similarity scores for each text.
    """
    try:
        # Get embeddings for the query and texts
        embeddings = cohere_client.embed(model='large', texts=[query] + texts)

        # Query embedding is the first; the rest are text embeddings
        query_embedding = embeddings.embeddings[0]
        text_embeddings = embeddings.embeddings[1:]

        # Calculate cosine similarity
        def cosine_similarity(vec1, vec2):
            return sum(a * b for a, b in zip(vec1, vec2)) / (
                (sum(a * a for a in vec1) ** 0.5) * (sum(b * b for b in vec2) ** 0.5)
            )

        similarities = [
            cosine_similarity(query_embedding, text_embedding) for text_embedding in text_embeddings
        ]

        return similarities
    except Exception as e:
        print("Error in call_cohere_similarity:", e)
        traceback.print_exc()
        return [0] * len(texts)  # Default to no similarity if an error occurs

def cohere_badges(query):
    """
    Returns a list of key words extracted from a query using Cohere.

    Args:
        query (str): The text query.

    Returns:
        dict: A dictionary with a single key 'badges' containing an array of key words.
    """
    try:
        if COHERE_API_KEY:
            # Use Cohere's Generate endpoint to process the query
            prompt = f"""You are a helpful assistant. Your job is to extract all the key words and ideas from the following query.
            Query: {query}
            
            You must only return a JSON dictionary where the only key is 'badges' and its value should be an array of the key words.
            """

            response = cohere_client.generate(
                model='command-xlarge-nightly',  # Use the most relevant Cohere model
                prompt=prompt,
                max_tokens=200,  # Limit tokens to focus on concise keyword extraction
                temperature=0.5,  # Balanced creativity
            )

            # Extract the response text and convert it to JSON
            response_text = response.generations[0].text.strip()
            return extract_json_from_response(response_text)
        else:
            print("COHERE_API_KEY not configured.")
            return {}
    except Exception as e:
        print("Error in cohere_badges:", e)
        traceback.print_exc()
        return {}

def generate_image_description(image_url):
    """
    Calls Groq to analyze the image directly via its URL and return a descriptive paragraph.

    Args:
        image_url (str): The Firebase Storage URL of the image.

    Returns:
        str: The description generated by Groq.
    """
    try:
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Write an annotation for the provided diagram. Keep it clean and simple, don't stray off topic at all.",
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": image_url,
                            },
                        },
                    ],
                }
            ],
            model="llama-3.2-90b-vision-preview",
        )
        return chat_completion.choices[0].message.content
    except Exception as e:
        print("Error in generate_description (Groq call):", e)
        traceback.print_exc()
        return "Could not generate annotation due to an error."

# -------------------------------------------------------------------
# 4) Endpoint: /scribble/upload
# -------------------------------------------------------------------
@app.route('/scribble/upload', methods=['POST'])
def upload_scribble():
    try:
        data = request.get_json()

        text = data.get('text')
        image_url = data.get('imageUrl', None)
        coordinates = data.get('coordinates', {})

        if not text or 'latitude' not in coordinates or 'longitude' not in coordinates:
            return jsonify({"error": "Invalid request data"}), 400

        new_scribble = {
            "text": text,
            "imageUrl": image_url,
            "coordinates": {
                "latitude": float(coordinates['latitude']),
                "longitude": float(coordinates['longitude'])
            },
            "createdAt": firestore.SERVER_TIMESTAMP
        }

        # Generate annotation using Groq if an image URL is provided
        if image_url:
            try:
                annotation = generate_image_description(image_url)
                new_scribble["annotation"] = annotation
            except Exception as e:
                print("Error annotating image in /scribble/upload:", e)

        db.collection('scribbles').add(new_scribble)
        return "Pushed your Scribble Hooray!", 200
    except Exception as e:
        print("An error occurred in /scribble/upload:", e)
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# -------------------------------------------------------------------
# 5) Endpoint: /scribble/search
# -------------------------------------------------------------------
@app.route('/scribble/search', methods=['POST'])
def search_scribble():
    try:
        global badges
        badges.clear()
        
        data = request.get_json()
        query = data.get('query', "").strip()

        if not query:
            return jsonify({"error": "No query provided"}), 400
        
        badges_response = cohere_badges(query)
        badges = badges_response.get("badges", [])
        print(f"Extracted badges: {badges}")

        # Pull all scribbles from Firestore
        scribbles_ref = db.collection('scribbles')
        scribbles = list(scribbles_ref.stream())

        # Prepare data for Cohere similarity
        input_data = [{"id": scribble.id, "text": scribble.to_dict().get('text', "")} for scribble in scribbles]

        # Extract texts for similarity
        texts = [item["text"] for item in input_data]
        ids = [item["id"] for item in input_data]

        # Call Cohere to get similarity results
        cohere_response = call_cohere_similarity(query, texts)

        print(f"IDs from Firestore: {ids}")
        print(f"Cohere Response: {cohere_response}")

        matching_scribbles = []

        # Process Cohere results
        for scribble, similarity in zip(input_data, cohere_response):
            s_dict = scribbles[ids.index(scribble["id"])].to_dict()
            scribble_id = scribble["id"]

            # Cohere result: True for similarity above threshold
            llm_result = similarity > 0.4

            # Log the matching result
            print(f"Scribble ID: {scribble_id}, Similarity: {similarity}, LLM Result: {llm_result}")

            # Update visibility and add matching scribbles
            scribbles[ids.index(scribble["id"])].reference.update({"visibility": llm_result})
            s_dict["visibility"] = llm_result
            if llm_result:
                s_dict["scribbleId"] = scribble_id
                matching_scribbles.append(s_dict)

        return jsonify({"results": matching_scribbles}), 200
    except Exception as e:
        print("An error occurred in /scribble/search:")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# -------------------------------------------------------------------
# 6) Endpoint: /scribble/ping
# -------------------------------------------------------------------
@app.route('/scribble/ping', methods=['POST'])
def ping_scribble():
    try:
        data = request.get_json()
        user_coords = data.get('coordinates', {})

        if 'latitude' not in user_coords or 'longitude' not in user_coords:
            return jsonify({"error": "Invalid coordinates"}), 400

        user_lat = float(user_coords['latitude'])
        user_lng = float(user_coords['longitude'])

        scribbles = list(db.collection('scribbles').stream())
        in_range_scribbles = []
        DEFAULT_RADIUS_METERS = 25
        for s in scribbles:
            s_dict = s.to_dict()

            scribble_coords = s_dict.get("coordinates", {})
            if not scribble_coords:
                continue

            scribble_lat = scribble_coords.get("latitude")
            scribble_lng = scribble_coords.get("longitude")
            dist = haversine_distance(user_lat, user_lng, scribble_lat, scribble_lng)

            if dist <= DEFAULT_RADIUS_METERS:
                s_dict["scribbleId"] = s.id
                in_range_scribbles.append(s_dict)

        if not in_range_scribbles:
            return jsonify({"results": None}), 204

        return jsonify({"results": in_range_scribbles}), 200
    except Exception as e:
        print("An error occurred in /scribble/ping:", e)
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# -------------------------------------------------------------------
# 7) Endpoint: /scribble/reset (DEPRACATED)
# -------------------------------------------------------------------
@app.route('/scribble/reset', methods=['POST'])
def reset_scribbles():
    try:
        scribbles = list(db.collection('scribbles').stream())
        for scribble in scribbles:
            scribble.reference.update({"visibility": True})
        return jsonify({"message": "All scribbles have been reset to visibility = True"}), 200
    except Exception as e:
        print("An error occurred in /scribble/reset:", e)
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# -------------------------------------------------------------------
# 8) Endpoint: /scribble/get_all
# -------------------------------------------------------------------
@app.route('/scribble/get_all', methods=['GET'])
def get_all_scribbles():
    try:
        # Retrieve all scribbles from Firestore
        scribbles = list(db.collection('scribbles').stream())
        
        # Convert the scribbles to a list of dictionaries
        scribble_list = [scribble.to_dict() for scribble in scribbles]
        
        # Return the list as a JSON array
        return jsonify({"scribbles": scribble_list}), 200
    except Exception as e:
        print("An error occurred in /scribble/get_all:", e)
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# -------------------------------------------------------------------
# 9) Endpoint: /badges/clear
# -------------------------------------------------------------------
@app.route('/badges/clear', methods=['POST'])
def clear_badges():
    """
    Clears the global badges array.
    """
    try:
        global badges
        badges.clear()
        return jsonify({"message": "Badges array has been cleared."}), 200
    except Exception as e:
        print("An error occurred in /badges/clear:")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# -------------------------------------------------------------------
# 8) Endpoint: /badges
# -------------------------------------------------------------------
@app.route('/badges', methods=['GET'])
def get_badges():
    """
    Retrieves the current state of the badges array.
    """
    try:
        global badges
        return jsonify({"badges": badges}), 200
    except Exception as e:
        print("An error occurred in /badges:")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
# -------------------------------------------------------------------
# X) Run the Flask App
# -------------------------------------------------------------------
if __name__ == '__main__':
    try:
        app.run(debug=True, host='0.0.0.0', port=5000)
    except Exception as e:
        print("Error running Flask app:", e)
        traceback.print_exc()
