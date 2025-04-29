import { useState, useEffect } from 'react';

// Main App component
export default function App() {
  // Define topics and their criteria
  const topics = [
    {
      name: "Strategic Alignment",
      criteria: [
        "Aligns with organizational vision",
        "Supports strategic objectives",
        "Enhances competitive positioning",
        "Addresses identified business needs",
        "Promotes long-term growth"
      ]
    },
    {
      name: "Value & Benefits",
      criteria: [
        "Financial return on investment",
        "Operational efficiency gains",
        "Customer experience improvement",
        "Market share potential",
        "Revenue generation capability"
      ]
    },
    {
      name: "Risk & Feasibility",
      criteria: [
        "Technical implementation complexity",
        "Organizational change readiness",
        "Regulatory compliance concerns",
        "Technology maturity & stability",
        "Implementation timeline realism"
      ]
    },
    {
      name: "Resource Availability",
      criteria: [
        "Required budget accessibility",
        "Internal expertise sufficiency",
        "Staff capacity to support",
        "Infrastructure readiness",
        "External partnership necessity"
      ]
    },
    {
      name: "Time Sensitivity",
      criteria: [
        "Market opportunity window",
        "Competitive pressure urgency",
        "Stakeholder expectation timing",
        "Dependencies on other initiatives",
        "Seasonal or cyclical factors"
      ]
    }
  ];

  // Application states
  const [currentPage, setCurrentPage] = useState('welcome');
  const [currentTopicIndex, setCurrentTopicIndex] = useState(0);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  
  // Initialize state for ratings and comments for all topics
  const [ratings, setRatings] = useState(() => {
    const savedRatings = localStorage.getItem('projectRatings');
    if (savedRatings) {
      return JSON.parse(savedRatings);
    }
    
    // Initialize empty ratings
    return topics.map(topic => 
      topic.criteria.map(() => null)
    );
  });
  
  const [comments, setComments] = useState(() => {
    const savedComments = localStorage.getItem('projectComments');
    if (savedComments) {
      return JSON.parse(savedComments);
    }
    
    // Initialize empty comments
    return topics.map(topic => 
      topic.criteria.map(() => '')
    );
  });
  
  // Store results for display
  const [results, setResults] = useState({
    totalScore: 0,
    topicScores: []
  });

  // Save state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('projectRatings', JSON.stringify(ratings));
    localStorage.setItem('projectComments', JSON.stringify(comments));
  }, [ratings, comments]);

  // Handle rating changes
  const handleRatingChange = (criterionIndex, value) => {
    const newRatings = [...ratings];
    newRatings[currentTopicIndex][criterionIndex] = parseInt(value);
    setRatings(newRatings);
  };

  // Handle comment changes
  const handleCommentChange = (criterionIndex, text) => {
    const newComments = [...comments];
    newComments[currentTopicIndex][criterionIndex] = text;
    setComments(newComments);
  };

  // Navigate to previous topic
  const goToPrevious = () => {
    if (currentTopicIndex > 0) {
      setCurrentTopicIndex(currentTopicIndex - 1);
    } else {
      setCurrentPage('welcome');
    }
  };

  // Navigate to next topic
  const goToNext = () => {
    // Check if all ratings in current topic are filled
    const currentTopicRatings = ratings[currentTopicIndex];
    const allRatingsProvided = currentTopicRatings.every(rating => rating !== null && rating !== '');
    
    if (!allRatingsProvided) {
      // Mark unanswered questions (by setting a flag in state)
      setShowValidationErrors(true);
      return;
    }
    
    // Reset validation errors flag when proceeding
    setShowValidationErrors(false);
    
    if (currentTopicIndex < topics.length - 1) {
      setCurrentTopicIndex(currentTopicIndex + 1);
    } else {
      setCurrentPage('results');
      calculateResults();
    }
  };

  // Calculate final results
  const calculateResults = () => {
    const topicScores = ratings.map((topicRatings, index) => {
      // Sum of all ratings for this topic (each rating 1-5)
      const ratingSum = topicRatings.reduce((sum, rating) => sum + (rating || 0), 0);
      // Max per topic = 5 criteria × 5 points = 25
      // Each topic worth 20 points: topicScore = (sum of ratings / 25) × 20
      const score = (ratingSum / 25) * 20;
      return {
        name: topics[index].name,
        score
      };
    });

    const totalScore = topicScores.reduce((sum, topic) => sum + topic.score, 0);
    
    setResults({
      totalScore,
      topicScores
    });
  };

  // Reset all data and return to welcome screen
  const restartQuestionnaire = () => {
    // Clear all ratings and comments
    setRatings(topics.map(topic => topic.criteria.map(() => null)));
    setComments(topics.map(topic => topic.criteria.map(() => '')));
    setCurrentTopicIndex(0);
    setCurrentPage('welcome');
    setShowValidationErrors(false);
    
    // Clear localStorage
    localStorage.removeItem('projectRatings');
    localStorage.removeItem('projectComments');
  };

  // Start the questionnaire from welcome page
  const startQuestionnaire = () => {
    setCurrentPage('questionnaire');
  };

  // Render the current topic's questions
  const renderQuestions = () => {
    const currentTopic = topics[currentTopicIndex];
    
    return (
      <div className="space-y-8">
        <h2 className="text-2xl font-bold text-blue-800">{currentTopic.name}</h2>
        
        {currentTopic.criteria.map((criterion, index) => (
          <div key={index} className={`p-4 ${showValidationErrors && (ratings[currentTopicIndex][index] === null || ratings[currentTopicIndex][index] === '') ? 'bg-red-50 border border-red-300' : 'bg-white'} rounded-lg shadow`}>
            <label className="block mb-2 font-medium">
              {criterion}
              <span className="text-red-600 ml-1">*</span>
            </label>
            <select 
              value={ratings[currentTopicIndex][index] || ''} 
              onChange={(e) => handleRatingChange(index, e.target.value)}
              className={`w-full p-2 mb-3 border ${showValidationErrors && (ratings[currentTopicIndex][index] === null || ratings[currentTopicIndex][index] === '') ? 'border-red-500 bg-red-50' : 'border-gray-300'} rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
              required
            >
              <option value="">Select rating</option>
              <option value="1">1 - Very Low</option>
              <option value="2">2 - Low</option>
              <option value="3">3 - Medium</option>
              <option value="4">4 - High</option>
              <option value="5">5 - Very High</option>
            </select>
            {showValidationErrors && (ratings[currentTopicIndex][index] === null || ratings[currentTopicIndex][index] === '') && (
              <p className="text-red-600 text-sm mb-2">Please select a rating</p>
            )}
            
            <label className="block mb-2 font-medium">Comments (Optional)</label>
            <textarea 
              value={comments[currentTopicIndex][index]} 
              onChange={(e) => handleCommentChange(index, e.target.value)}
              className="w-full p-2 border rounded h-24 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Add any comments or justification here"
            />
          </div>
        ))}
      </div>
    );
  };

  // Render the page based on current state
  const renderPage = () => {
    switch (currentPage) {
      case 'welcome':
        return (
          <div className="text-center space-y-6">
            <h1 className="text-4xl font-bold text-blue-900">Project Priority Scoring</h1>
            <p className="text-lg text-gray-700">
              This tool helps you evaluate projects across 25 criteria grouped in 5 strategic categories.
              Rate each criterion on a scale of 1-5 to generate a weighted priority score.
              <span className="block mt-2 text-sm text-blue-700">All ratings are required to complete the assessment.</span>
            </p>
            <button 
              onClick={startQuestionnaire}
              className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow hover:bg-blue-700 transition duration-200"
            >
              Start Questionnaire
            </button>
          </div>
        );
        
      case 'questionnaire':
        return (
          <div className="space-y-8">
            <div className="mb-4 flex justify-between items-center">
              <h1 className="text-3xl font-bold text-blue-900">Project Priority Assessment</h1>
              <div className="text-sm text-gray-600">
                Topic {currentTopicIndex + 1} of {topics.length}
              </div>
            </div>
            
            {/* Progress bar */}
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-blue-600 h-2.5 rounded-full" 
                style={{ width: `${((currentTopicIndex) / topics.length) * 100}%` }}
              ></div>
            </div>
            
            {renderQuestions()}
            
            <div className="flex justify-between mt-8">
              <button 
                onClick={goToPrevious}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition duration-200"
              >
                {currentTopicIndex === 0 ? 'Back to Welcome' : 'Previous Topic'}
              </button>
              
              {showValidationErrors && (
                <div className="text-red-600 text-sm font-medium flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Please complete all required ratings
                </div>
              )}
              
              <button 
                onClick={goToNext}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition duration-200"
              >
                {currentTopicIndex === topics.length - 1 ? 'Submit' : 'Next Topic'}
              </button>
            </div>
          </div>
        );
        
      case 'results':
        return (
          <div className="space-y-8">
            <h1 className="text-3xl font-bold text-blue-900">Priority Assessment Results</h1>
            
            <div className="p-6 bg-blue-50 rounded-lg shadow-lg border border-blue-200">
              <h2 className="text-2xl font-bold text-center mb-4">
                Total Priority Score: {results.totalScore.toFixed(2)} / 100
              </h2>
              
              <div className="w-full bg-gray-200 rounded-full h-4 mb-6">
                <div 
                  className="bg-blue-600 h-4 rounded-full" 
                  style={{ width: `${results.totalScore}%` }}
                ></div>
              </div>
              
              <div className="space-y-4">
                <h3 className="font-semibold text-lg mb-2">Category Breakdown:</h3>
                {results.topicScores.map((topic, index) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-white rounded shadow">
                    <span className="font-medium">{topic.name}:</span>
                    <span className="font-semibold">{topic.score.toFixed(2)} points</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="text-center mt-8">
              <button 
                onClick={restartQuestionnaire}
                className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow hover:bg-blue-700 transition duration-200"
              >
                Start New Assessment
              </button>
            </div>
          </div>
        );
        
      default:
        return <div>Loading...</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {renderPage()}
      </div>
    </div>
  );
}
