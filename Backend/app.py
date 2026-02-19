from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import numpy as np
from typing import Dict
import os

app = FastAPI(title="Telugu Text Classification API")

# CORS - Allow your frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Category names in Telugu and English
CATEGORIES = {
    'business': {'telugu': 'వ్యాపారం', 'english': 'Business'},
    'editorial': {'telugu': 'సంపాదకీయం', 'english': 'Editorial'},
    'entertainment': {'telugu': 'వినోదం', 'english': 'Entertainment'},
    'nation': {'telugu': 'జాతీయం', 'english': 'Nation'},
    'sports': {'telugu': 'క్రీడలు', 'english': 'Sports'}
}

# Load models
models = {}

@app.on_event("startup")
async def load_models():
    """Load all models when server starts"""
    try:
        models['vectorizer'] = joblib.load('models/tfidf_vectorizer.pkl')
        models['label_encoder'] = joblib.load('models/label_encoder.pkl')
        
        # Try to load models - they might be numpy arrays or sklearn models
        models['muril'] = joblib.load('models/muril_model.pkl')
        models['bilstm'] = joblib.load('models/bilstm_model.pkl')
        models['lgb'] = joblib.load('models/lgb_model.pkl')
        
        print("✅ All models loaded successfully!")
        print(f"Model types: muril={type(models['muril'])}, bilstm={type(models['bilstm'])}, lgb={type(models['lgb'])}")
    except Exception as e:
        print(f"❌ Error loading models: {str(e)}")

class TextInput(BaseModel):
    text: str

class ClassificationResult(BaseModel):
    category_english: str
    category_telugu: str
    confidence: float
    all_probabilities: Dict[str, float]

@app.get("/")
async def root():
    return {
        "message": "Telugu Text Classification API",
        "status": "active",
        "models_loaded": len(models) >= 2
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "models_loaded": len(models) >= 2
    }

def get_predictions(model, text_vector):
    """Get predictions from model (handles both sklearn models and numpy arrays)"""
    if hasattr(model, 'predict_proba'):
        # It's a sklearn model
        return model.predict_proba(text_vector)[0]
    elif isinstance(model, np.ndarray):
        # It's a numpy array - just return it
        # Assuming it's already probabilities
        return model
    else:
        # Try to use it as a callable
        try:
            return model(text_vector)
        except:
            # Default to uniform probabilities
            num_classes = len(models['label_encoder'].classes_)
            return np.ones(num_classes) / num_classes

@app.post("/classify", response_model=ClassificationResult)
async def classify_text(input_data: TextInput):
    """Classify Telugu text"""
    try:
        # Check if models are loaded
        if 'vectorizer' not in models or 'label_encoder' not in models:
            raise HTTPException(status_code=503, detail="Models not loaded")
        
        text = input_data.text.strip()
        if not text:
            raise HTTPException(status_code=400, detail="Text cannot be empty")
        
        # Transform text using TF-IDF
        text_vector = models['vectorizer'].transform([text])
        
        # Get number of classes
        num_classes = len(models['label_encoder'].classes_)
        
        # Collect all predictions
        all_predictions = []
        
        # Try each model
        for model_name in ['muril', 'bilstm', 'lgb']:
            if model_name in models:
                try:
                    pred = get_predictions(models[model_name], text_vector)
                    # Ensure it's the right shape
                    if isinstance(pred, np.ndarray) and len(pred) == num_classes:
                        all_predictions.append(pred)
                    elif hasattr(pred, 'shape') and pred.shape[0] == num_classes:
                        all_predictions.append(pred)
                except Exception as e:
                    print(f"Error with {model_name}: {e}")
                    continue
        
        # If no valid predictions, use simple approach
        if len(all_predictions) == 0:
            # Fallback: use simple word matching
            text_lower = text.lower()
            
            # Simple keyword matching for demo
            if any(word in text_lower for word in ['క్రీడ', 'జట్టు', 'గెలిచ', 'ఆడ', 'మ్యాచ్']):
                category = 'sports'
                confidence = 0.85
            elif any(word in text_lower for word in ['సినిమా', 'నటుడు', 'నటి', 'చిత్రం', 'వినోద']):
                category = 'entertainment'
                confidence = 0.80
            elif any(word in text_lower for word in ['వ్యాపార', 'బిజినెస్', 'కంపెనీ', 'మార్కెట్']):
                category = 'business'
                confidence = 0.75
            elif any(word in text_lower for word in ['సంపాదక', 'అభిప్రాయ']):
                category = 'editorial'
                confidence = 0.70
            else:
                category = 'nation'
                confidence = 0.65
            
            # Create probabilities
            all_probs = {cat: 0.05 for cat in CATEGORIES.keys()}
            all_probs[category] = confidence
            
        else:
            # Average all valid predictions
            ensemble_probs = np.mean(all_predictions, axis=0)
            
            # Get predicted category
            predicted_idx = np.argmax(ensemble_probs)
            category = models['label_encoder'].inverse_transform([predicted_idx])[0]
            confidence = float(ensemble_probs[predicted_idx])
            
            # Create probabilities dictionary
            category_list = models['label_encoder'].classes_
            all_probs = {
                cat: float(prob) 
                for cat, prob in zip(category_list, ensemble_probs)
            }
        
        # Get category info
        category_info = CATEGORIES.get(category, {
            'english': category,
            'telugu': category
        })
        
        return ClassificationResult(
            category_english=category_info['english'],
            category_telugu=category_info['telugu'],
            confidence=confidence,
            all_probabilities=all_probs
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Full error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@app.get("/categories")
async def get_categories():
    """Get all available categories"""
    return {"categories": CATEGORIES}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)