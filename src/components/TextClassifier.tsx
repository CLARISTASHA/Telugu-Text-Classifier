// src/components/TextClassifier.tsx

import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { LogOut, Sparkles, Brain, TrendingUp } from 'lucide-react';
import { classificationAPI, ClassificationResult as APIResult, ClassificationAPIError } from '../api/classification';

interface ClassificationResult {
  categoryTelugu: string;
  categoryEnglish: string;
  confidence: number;
  allProbabilities?: Record<string, number>;
}

export default function TextClassifier() {
  const { user, signOut } = useAuth();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ClassificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const classifyText = async () => {
    if (!text.trim()) {
      setError('దయచేసి వచనాన్ని నమోదు చేయండి (Please enter text)');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Call real ML API
      const apiResult: APIResult = await classificationAPI.classifyText(text);

      const classificationResult = {
        categoryTelugu: apiResult.category_telugu,
        categoryEnglish: apiResult.category_english,
        confidence: Math.round(apiResult.confidence * 100),
        allProbabilities: apiResult.all_probabilities,
      };

      setResult(classificationResult);

      // Save to Firebase if user is logged in
      if (user) {
        try {
          await addDoc(collection(db, 'classification_history'), {
            userId: user.uid,
            textInput: text,
            category: apiResult.category_english,
            categoryTelugu: apiResult.category_telugu,
            confidence: Math.round(apiResult.confidence * 100),
            allProbabilities: apiResult.all_probabilities,
            createdAt: serverTimestamp(),
          });
        } catch (error) {
          console.error('Error saving classification:', error);
        }
      }
    } catch (err) {
      if (err instanceof ClassificationAPIError) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred');
      }
      console.error('Classification error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      business: 'from-blue-500 to-blue-600',
      editorial: 'from-purple-500 to-purple-600',
      entertainment: 'from-pink-500 to-pink-600',
      nation: 'from-green-500 to-green-600',
      sports: 'from-orange-500 to-orange-600',
    };
    return colors[category.toLowerCase()] || 'from-gray-500 to-gray-600';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-lg border-b border-slate-200/60 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                Telugu AI Classifier
              </span>
            </div>
            <button
              onClick={signOut}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all duration-300 hover:scale-105"
            >
              <LogOut className="w-4 h-4" />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-800 mb-4">
            AI-Powered Text Classification
          </h1>
          <p className="text-lg text-slate-600">
            Advanced Telugu language understanding powered by machine learning
          </p>
        </div>

        {/* Input Section */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200/60 p-8 mb-8 animate-slide-up">
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              Enter Telugu Text
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="మీ తెలుగు వాక్యాన్ని ఇక్కడ నమోదు చేయండి..."
              rows={6}
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 text-lg resize-none"
              disabled={loading}
            />
          </div>

          <button
            onClick={classifyText}
            disabled={loading || !text.trim()}
            className="w-full py-4 px-6 bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold rounded-2xl shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>Classify Text</span>
              </>
            )}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg animate-fade-in">
            <p className="text-red-700 font-medium">{error}</p>
            <p className="text-red-600 text-sm mt-1">
              Make sure the backend is running on port 8000
            </p>
          </div>
        )}

        {/* Results Section */}
        {result && (
          <div className="grid gap-6 animate-fade-in">
            <div className="bg-white rounded-3xl shadow-xl border border-slate-200/60 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
                  <Brain className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800">Classification Result</h2>
              </div>

              <div className="space-y-6">
                {/* Category Display */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-600">Category</span>
                  </div>
                  <div className={`px-6 py-6 bg-gradient-to-r ${getCategoryColor(result.categoryEnglish)} bg-opacity-10 rounded-2xl border border-purple-200/50`}>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <p className="text-sm text-slate-500 mb-1">Telugu</p>
                        <p className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                          {result.categoryTelugu}
                        </p>
                      </div>
                      <div className="hidden sm:block w-px h-12 bg-gradient-to-b from-transparent via-slate-300 to-transparent" />
                      <div>
                        <p className="text-sm text-slate-500 mb-1">English</p>
                        <p className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                          {result.categoryEnglish}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Confidence Score */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-slate-600 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Confidence Score
                    </span>
                    <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                      {result.confidence}%
                    </span>
                  </div>
                  <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-1000 ease-out shadow-lg shadow-purple-500/50"
                      style={{ width: `${result.confidence}%` }}
                    />
                  </div>
                </div>

                {/* All Probabilities */}
                {result.allProbabilities && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-600 mb-3">
                      All Category Probabilities
                    </h4>
                    <div className="space-y-2">
                      {Object.entries(result.allProbabilities)
                        .sort(([, a], [, b]) => b - a)
                        .map(([category, probability]) => (
                          <div key={category} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="font-medium text-slate-700 capitalize">
                                {category}
                              </span>
                              <span className="text-slate-600">
                                {(probability * 100).toFixed(2)}%
                              </span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full bg-gradient-to-r ${getCategoryColor(category)} transition-all duration-500`}
                                style={{ width: `${probability * 100}%` }}
                              />
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Model Info */}
        <div className="mt-8 text-center text-sm text-slate-500">
          <p>Powered by Ensemble Model </p>
          <p className="mt-1">Text Classification</p>
        </div>
      </main>
    </div>
  );
}