import React, { useState, useEffect } from 'react';
// Removed: import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// Define the structure for criteria and topics
/**
 * @typedef {object} Criterion
 * @property {string} label
 * @property {number | null} rating
 * @property {string} comment
 */

/**
 * @typedef {object} Topic
 * @property {string} name
 * @property {Criterion[]} criteria
 */

// Define the topics and their criteria
const initialTopics = [
    {
        name: 'Strategic Alignment',
        criteria: [
            { label: 'Alignment with Strategic Goals', rating: null, comment: '' },
            { label: 'Contribution to Mission', rating: null, comment: '' },
            { label: 'Impact on Objectives', rating: null, comment: '' },
            { label: 'Stakeholder Alignment', rating: null, comment: '' },
            { label: 'Long-Term Vision', rating: null, comment: '' },
        ],
    },
    {
        name: 'Value & Benefits',
        criteria: [
            { label: 'Potential Benefits', rating: null, comment: '' },
            { label: 'Return on Investment', rating: null, comment: '' },
            { label: 'Value for Customers', rating: null, comment: '' },
            { label: 'Market Opportunity', rating: null, comment: '' },
            { label: 'Competitive Advantage', rating: null, comment: '' },
        ],
    },
    {
        name: 'Risk & Feasibility',
        criteria: [
            { label: 'Technical Feasibility', rating: null, comment: '' },
            { label: 'Implementation Risk', rating: null, comment: '' },
            { label: 'Operational Risks', rating: null, comment: '' },
            { label: 'Regulatory Compliance', rating: null, comment: '' },
            { label: 'Risk Mitigation', rating: null, comment: '' },
        ],
    },
    {
        name: 'Resource Availability',
        criteria: [
            { label: 'Financial Resources', rating: null, comment: '' },
            { label: 'Human Resources', rating: null, comment: '' },
            { label: 'Technological Resources', rating: null, comment: '' },
            { label: 'Material Resources', rating: null, comment: '' },
            { label: 'Infrastructure', rating: null, comment: '' },
        ],
    },
    {
        name: 'Time Sensitivity',
        criteria: [
            { label: 'Urgency', rating: null, comment: '' },
            { label: 'Time Constraints', rating: null, comment: '' },
            { label: 'Critical Path', rating: null, comment: '' },
            { label: 'Market Window', rating: null, comment: '' },
            { label: 'Project Deadline', rating: null, comment: '' },
        ],
    },
];

// Helper function to calculate the score
const calculateScore = (topics) => {
    const topicScores = {};
    let totalScore = 0;

    topics.forEach((topic) => {
        let topicSum = 0;
        topic.criteria.forEach((criterion) => {
            topicSum += criterion.rating || 0;
        });
        // max per topic = 5 criteria × 5 points = 25
        // each topic worth 20 points:
        const topicScore = (topicSum / 25) * 20;
        topicScores[topic.name] = topicScore;
        totalScore += topicScore;
    });

    return { totalScore, topicScores };
};

// Main App Component
const ProjectPrioritizationApp = () => {
    // State for managing the topics and current screen
    const [topics, setTopics] = useState(initialTopics);
    const [currentScreen, setCurrentScreen] = useState('welcome');
    const [isLocalStorageAvailable, setIsLocalStorageAvailable] = useState(true); // Assume available initially
    const [missingFields, setMissingFields] = useState([]);

    // Load state from localStorage on component mount
    useEffect(() => {
        try {
            const savedTopics = localStorage.getItem('projectPrioritizationTopics');
            if (savedTopics) {
                setTopics(JSON.parse(savedTopics));
                setCurrentScreen('questionnaire'); // Or 'results' if it was already submitted
            }
        } catch (error) {
            console.error("localStorage is not available:", error);
            setIsLocalStorageAvailable(false);
        }
    }, []);

    // Save state to localStorage whenever topics change
    useEffect(() => {
        if (isLocalStorageAvailable) {
            localStorage.setItem('projectPrioritizationTopics', JSON.stringify(topics));
        }
    }, [topics, isLocalStorageAvailable]);

    // Handler for updating a criterion's rating
    const handleRatingChange = (topicIndex, criterionIndex, rating) => {
        setTopics((prevTopics) => {
            const newTopics = [...prevTopics];
            const newTopic = { ...newTopics[topicIndex] };
            const newCriteria = [...newTopic.criteria];
            const newCriterion = { ...newCriteria[criterionIndex] };
            newCriterion.rating = rating;
            newCriteria[criterionIndex] = newCriterion;
            newTopic.criteria = newCriteria;
            newTopics[topicIndex] = newTopic;
            return newTopics;
        });
    };

    // Handler for updating a criterion's comment
    const handleCommentChange = (topicIndex, criterionIndex, comment) => {
        setTopics((prevTopics) => {
            const newTopics = [...prevTopics];
            const newTopic = { ...newTopics[topicIndex] };
            const newCriteria = [...newTopic.criteria];
            const newCriterion = { ...newCriteria[criterionIndex] };
            newCriterion.comment = comment;
            newCriteria[criterionIndex] = newCriterion;
            newTopic.criteria = newCriteria;
            newTopics[topicIndex] = newTopic;
            return newTopics;
        });
    };

    // Handler for moving to the next screen
    const handleNext = () => {
        if (currentScreen === 'welcome') {
            setCurrentScreen('questionnaire');
        } else if (currentScreen === 'questionnaire') {
            // Basic validation: Check if all ratings are provided
            let allRated = true;
            const missing = [];
            for (const topic of topics) {
                for (const criterion of topic.criteria) {
                    if (criterion.rating === null) {
                        allRated = false;
                        missing.push(criterion.label);
                    }
                }
            }

            if (allRated) {
                setCurrentScreen('results');
                setMissingFields([]); // Clear any previous missing fields
            } else {
                setMissingFields(missing);
                alert('Please rate all criteria before submitting.');
            }
        }
    };

    // Handler for moving to the previous screen
    const handlePrevious = () => {
        if (currentScreen === 'questionnaire') {
            setCurrentScreen('welcome');
            setMissingFields([]);
        }
    };

    // Handler for restarting the questionnaire
    const handleRestart = () => {
        setTopics(initialTopics);
        setCurrentScreen('welcome');
        if (isLocalStorageAvailable) {
            localStorage.removeItem('projectPrioritizationTopics');
        }
        setMissingFields([]);
    };

    // Calculate scores when the results screen is displayed
    const { totalScore, topicScores } = currentScreen === 'results' ? calculateScore(topics) : { totalScore: 0, topicScores: {} };

    // Render different screens based on the current state
    switch (currentScreen) {
        case 'welcome':
            return (
                <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
                    <div className="max-w-2xl mx-auto text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                            Project Prioritization Tool
                        </h1>
                        <p className="text-gray-600 dark:text-gray-300 mb-8">
                            Evaluate and prioritize your projects by answering a few questions.
                        </p>
                        <button // Replaced Button with standard HTML button
                            onClick={handleNext}
                            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                        >
                            Start Questionnaire
                        </button>
                    </div>
                </div>
            );

        case 'questionnaire':
            return (
                <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
                    <div className="max-w-4xl mx-auto space-y-6">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white text-center">
                            Project Questionnaire
                        </h1>
                        {topics.map((topic, topicIndex) => (
                            <div key={topicIndex} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{topic.name}</h2>
                                {topic.criteria.map((criterion, criterionIndex) => (
                                    <div key={criterionIndex} className={cn(
                                        "mb-4 p-4 rounded-md bg-gray-50 dark:bg-gray-700/50",
                                        missingFields.includes(criterion.label) && 'border-2 border-red-500' // Highlight missing fields
                                    )}>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            {criterion.label}
                                            <span className="text-red-500">*</span> {/* Make Rating mandatory */}
                                        </label>
                                        <select
                                            value={criterion.rating === null ? '' : criterion.rating}
                                            onChange={(e) =>
                                                handleRatingChange(
                                                    topicIndex,
                                                    criterionIndex,
                                                    e.target.value === '' ? null : parseInt(e.target.value, 10)
                                                )
                                            }
                                            className={cn(
                                                "mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white",
                                                missingFields.includes(criterion.label) && criterion.rating === null && 'border-red-500'
                                            )}
                                        >
                                            <option value="">Select rating</option>
                                            <option value="1">1</option>
                                            <option value="2">2</option>
                                            <option value="3">3</option>
                                            <option value="4">4</option>
                                            <option value="5">5</option>
                                        </select>
                                        <Textarea
                                            value={criterion.comment}
                                            onChange={(e) =>
                                                handleCommentChange(topicIndex, criterionIndex, e.target.value)
                                            }
                                            placeholder="Enter your comments (optional)"
                                            className="mt-2 block w-full text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:ring-blue-500 focus:border-blue-500 rounded-md"
                                        />
                                    </div>
                                ))}
                            </div>
                        ))}
                        <div className="flex justify-between">
                            <button  // Replaced Button with standard HTML button
                                onClick={handlePrevious}
                                className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded"
                            >
                                Previous
                            </button>
                            <button // Replaced Button with standard HTML button
                                onClick={handleNext}
                                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                            >
                                Submit
                            </button>
                        </div>
                    </div>
                </div>
            );

        case 'results':
            return (
                <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
                    <div className="max-w-2xl mx-auto text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
                            Project Prioritization Results
                        </h1>
                        <p className="text-2xl font-semibold text-blue-600 dark:text-blue-400 mb-4">
                            Total Priority Score: {totalScore.toFixed(2)} / 100
                        </p>
                        <div className="mb-6">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Topic Scores:</h2>
                            <ul className="list-none">
                                {Object.entries(topicScores).map(([topicName, score]) => (
                                    <li key={topicName} className="text-gray-700 dark:text-gray-300">
                                        {topicName}: {score.toFixed(2)} / 20
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <button // Replaced Button with standard HTML button
                            onClick={handleRestart}
                            className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                        >
                            Restart
                        </button>
                    </div>
                </div>
            );

        default:
            return null;
    }
};

export default ProjectPrioritizationApp;

