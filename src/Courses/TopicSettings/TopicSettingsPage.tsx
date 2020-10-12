import { FormControlLabel, Grid, Switch } from '@material-ui/core';
import React, { useEffect, useState } from 'react';
import { CourseTopicAssessmentInfo, ProblemObject, TopicObject, UnitObject } from '../CourseInterfaces';
import MomentUtils from '@date-io/moment';
import { MuiPickersUtilsProvider, DateTimePicker } from '@material-ui/pickers';
import TopicSettingsSidebar from './TopicSettingsSidebar';
import { useCourseContext } from '../CourseProvider';
import { useParams } from 'react-router-dom';
import _ from 'lodash';
import SettingsForm from './SettingsForm';
import { postQuestion, putQuestion } from '../../APIInterfaces/BackendAPI/Requests/CourseRequests';

interface TopicSettingsPageProps {

}


export const TopicSettingsPage: React.FC<TopicSettingsPageProps> = () => {
    const [selectedProblemId, setSelectedProblemId] = useState<number | 'topic'>('topic');
    const [topic, setTopic] = useState<TopicObject | null>(null);
    
    const {course, setCourse, error} = useCourseContext();
    const { topicId: topicIdStr } = useParams<{topicId?: string}>();
    const topicId = topicIdStr ? parseInt(topicIdStr, 10) : null;
    
    useEffect(()=>{
        if (!topicId) {
            console.error('No topicId!', window.location);
            return;
        }

        let topicObj;
        for (let unit of course.units) {
            if (!topic) {
                topicObj = _.find(unit.topics, ['id', topicId]);
                setTopic(new TopicObject(topicObj));
                break;
            }
        }

        if (_.isNil(topicObj)) {
            console.error(`No Topic found with ${topicId}`);
            return;
        }
    }, [course]);

    const addNewProblem = async () => {
        if (_.isNil(topicId) || _.isNil(topic)) {
            console.error('Tried to add a new problem with no topicId');
            return;
        }

        try {
            const result = await postQuestion({
                data: {
                    courseTopicContentId: topicId
                }
            });
        
            const newProb = new ProblemObject(result.data.data);
            const newTopic = new TopicObject(topic);
            newTopic.questions.push(newProb);

            setTopic(newTopic);
        } catch (e) {
            console.error('Failed to create a new problem with default settings.', e);
        }
    };


    const handleDrag = async (result: any) => {
        try {
            if (!topic) {
                console.error('Received a drag event on a null topic.', result);
                return;
            }

            if (!result.destination) {
                return;
            }
    
            if (result.destination.index === result.source.index) {
                return;
            }
            console.log('Drag result:', result);
    
            const newContentOrder: number = result.destination.index + 1;
            const problemIdRegex = /^problemRow(\d+)$/;
            const { draggableId: problemDraggableId } = result;
            // If exec doesn't match the result will be null
            // If it does succeed the index `1` will always be the group above
            const problemIdStr = problemIdRegex.exec(problemDraggableId)?.[1];
            if(_.isNil(problemIdStr)) {
                console.error('problem not found could not update backend');
                return;
            }
            const problemId = parseInt(problemIdStr, 10);

            let newTopic = new TopicObject(topic);
            const existingProblem = _.find(newTopic.questions, ['id', problemId]);

            if(_.isNil(existingProblem)) {
                console.error('existing problem not found could not update frontend');
                return;
            }

            existingProblem.problemNumber = newContentOrder;
            const [removed] = newTopic.questions.splice(result.source.index, 1);
            newTopic.questions.splice(result.destination.index, 0, removed);

            const response = await putQuestion({
                id: problemId,
                data: {
                    problemNumber: newContentOrder,
                },
            });
            
            response.data.data.updatesResult.forEach((returnedProblem: Partial<ProblemObject>) => {
                const existingProblem = _.find(newTopic.questions, ['id', returnedProblem.id]);
                Object.assign(existingProblem, returnedProblem);
            });

            setTopic(newTopic);
        } catch (e) {
            console.error('Drag/Drop error:', e);
        }
    };

    if (_.isNil(topicIdStr)) {
        return null;
    }
    
    return (
        <MuiPickersUtilsProvider utils={MomentUtils}>
            <Grid container spacing={5} style={{margin: '0rem 5rem 0rem 5rem'}}>
                {/* Sidebar */}
                <TopicSettingsSidebar 
                    topic={topic || new TopicObject()} 
                    selectedProblemId={selectedProblemId} 
                    setSelectedProblemId={setSelectedProblemId}
                    addNewProblem={addNewProblem}
                    handleDrag={handleDrag}
                />
                {/* Problem List */}
                <SettingsForm 
                    selectedProblemId={selectedProblemId} 
                />
            </Grid>
        </MuiPickersUtilsProvider>
    );
};

export default TopicSettingsPage;