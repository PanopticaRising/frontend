import React, { useEffect, useState } from 'react';
import { Button, Grid } from '@material-ui/core';
import { MultipleProblemPaths, OptionalField, ProblemMaxAttempts, ProblemPath, ProblemWeight, RandomSeedSet } from './GenericFormInputs';
import { Link } from 'react-router-dom';
import { ProblemObject, TopicObject, TopicTypeId } from '../CourseInterfaces';
import { ProblemSettingsInputs } from './TopicSettingsPage';
import { useForm, FormProvider } from 'react-hook-form';
import { deleteQuestion, putQuestion } from '../../APIInterfaces/BackendAPI/Requests/CourseRequests';
import _ from 'lodash';
import useAlertState from '../../Hooks/useAlertState';
import { Alert } from 'react-bootstrap';
import { ConfirmationModal } from '../../Components/ConfirmationModal';
import { DevTool } from '@hookform/devtools';

import './TopicSettings.css';
import logger from '../../Utilities/Logger';
import RendererPreview from './RendererPreview';

interface ProblemSettingsProps {
    selected: ProblemObject;
    // Used to reset the selected bar after a deletion occurs.
    setSelected: React.Dispatch<React.SetStateAction<TopicObject | ProblemObject>>;
    setTopic: React.Dispatch<React.SetStateAction<TopicObject | null>>;
    topic: TopicObject;
}

export const ProblemSettings: React.FC<ProblemSettingsProps> = ({selected, setSelected, setTopic, topic}) => {
    const additionalProblemPathsArray = selected.courseQuestionAssessmentInfo?.additionalProblemPaths;
    const additionalProblemPathsArrayIsEmpty = _.isNil(additionalProblemPathsArray) || _.isEmpty(additionalProblemPathsArray);

    const defaultValues : ProblemSettingsInputs = {
        ...selected,
        courseQuestionAssessmentInfo: {
            randomSeedSet: [],
            ...selected.courseQuestionAssessmentInfo,
            ...(
                additionalProblemPathsArrayIsEmpty ?
                    {
                        additionalProblemPaths: [{path: selected.webworkQuestionPath || ''}]
                    } : 
                    {
                        additionalProblemPaths: additionalProblemPathsArray.map((s: string) => ({path: s})),
                    }
            ),
        }
    };

    const formSettings: {mode: 'onSubmit', shouldFocusError: boolean, defaultValues: ProblemSettingsInputs} = {
        mode: 'onSubmit', 
        shouldFocusError: true,
        defaultValues: defaultValues
    };

    const topicForm = useForm<ProblemSettingsInputs>(formSettings);

    const { handleSubmit, control, watch, reset } = topicForm;
    const { optional, webworkQuestionPath } = watch();
    const additionalProblemPaths = watch('courseQuestionAssessmentInfo.additionalProblemPaths', [{path: ''}]);
    const [{ message: updateAlertMsg, variant: updateAlertType }, setUpdateAlert] = useAlertState();
    const [showConfirmDelete, setShowConfirmDelete] = useState<boolean>(false);

    useEffect(()=>{
        let defaultAdditionalProblemPaths = [{path: selected.webworkQuestionPath || ''}];
        // Force renders to always include one empty path at the end.
        if (!additionalProblemPathsArrayIsEmpty) {
            const additionalProblemPathsArrayWithPadding = additionalProblemPathsArray.map((s: string) => ({path: s}));
            defaultAdditionalProblemPaths = [...additionalProblemPathsArrayWithPadding, {path: ''}];
        }
        reset({
            ...selected,
            ...(topic.topicTypeId === TopicTypeId.EXAM && {
                courseQuestionAssessmentInfo: {
                    additionalProblemPaths: defaultAdditionalProblemPaths,
                    randomSeedSet: selected.courseQuestionAssessmentInfo?.randomSeedSet || [],
                }
            }
            )
        });
        setUpdateAlert({message: '', variant: 'warning'});
    }, [selected, additionalProblemPathsArray, additionalProblemPathsArrayIsEmpty, reset, setUpdateAlert, topic.topicTypeId]);

    const onSubmit = async (data: ProblemSettingsInputs) => {
        if (_.isNil(selected)) {
            logger.error('Tried to submit while problem was blank!');
            return;
        }

        // React Hook Forms only supports nested field array structures, so we have to flatten it ourselves.
        const fieldArray = data.courseQuestionAssessmentInfo?.additionalProblemPaths?.map?.(f => f.path);
        const updateAssessmentInfo = (data.courseQuestionAssessmentInfo && {
            courseQuestionAssessmentInfo: {
                ...(data.courseQuestionAssessmentInfo.additionalProblemPaths && {additionalProblemPaths: _.compact(fieldArray)}),
                randomSeedSet: data.courseQuestionAssessmentInfo.randomSeedSet,
            }
        });

        try {
            const res = await putQuestion({
                id: selected.id,
                data: {
                    ...data,
                    ...updateAssessmentInfo
                }
            });

            const dataFromBackend = res.data.data.updatesResult?.[0];
            setUpdateAlert({message: 'Successfully updated', variant: 'success'});

            // Overwrite fields from the original object. This resets the state object when clicking between options.
            const newTopic = new TopicObject(topic);
            const newQuestion = _.find(newTopic.questions, ['id', selected.id]);

            // TODO: Right now, the backend does not return the courseQuestionAssessmentInfo, so we should use the local data
            // if the attempt was a success.
            _.assign(newQuestion, dataFromBackend, updateAssessmentInfo);
            setTopic(newTopic);
        } catch (e) {
            logger.error('Error updating topic.', e);
            setUpdateAlert({message: e.message, variant: 'danger'});
        }
    };

    const onDelete = async () => {
        setUpdateAlert({message: '', variant: 'warning'});
        try {
            const problemId = selected.id;
            const problemNumber = selected.problemNumber;
            await deleteQuestion({
                id: problemId
            });    
            let newProblems = [...topic.questions];
            const deletedProblem = _.find(newProblems, ['id', problemId]);
            // Decrement everything after
            if (!_.isNil(deletedProblem)) {
                _.filter(newProblems, problem => problem.problemNumber > deletedProblem.problemNumber).forEach(problem => problem.problemNumber--);
            }
            newProblems = _.reject(newProblems, ['id', problemId]);
            const newTopic = new TopicObject(topic);
            newTopic.questions = newProblems;
            setTopic(newTopic);
            // If the problem we deleted was the last one, reset back to topic.
            if (newProblems.length === 0) {
                setSelected(newTopic);
            } else {
                setSelected(problemNumber < newTopic.questions.length ? newTopic.questions[problemNumber - 1] : newTopic.questions[problemNumber - 2]);
            }

            setUpdateAlert({message: 'Successfully deleted question', variant: 'success'});
        } catch (e) {
            setUpdateAlert({message: e.message, variant: 'danger'});
        }
    };

    return (
        <FormProvider {...topicForm}>
            <form onChange={() => {if (updateAlertMsg !== '') setUpdateAlert({message: '', variant: 'warning'});}} onSubmit={handleSubmit(onSubmit)}>
                <DevTool control={control} />
                <Grid container item md={12} spacing={3}>
                    {(updateAlertMsg !== '') && <Grid md={12} item><Alert variant={updateAlertType}>{updateAlertMsg}</Alert></Grid>}
                    <Grid container item md={12} spacing={3}>
                        <Grid item container md={12}><h1>Problem Settings</h1></Grid>
                        <Grid item md={8}>
                            Enter the path to the problem on the Rederly server. This is prefaced either 
                            with <code>Library/</code> or <code>Contrib/</code> if the desired problem is included 
                            in the <Link to='https://github.com/openwebwork/webwork-open-problem-library'>OPL</Link> or <code>private/</code> if 
                            this problem has been uploaded to your private Rederly folder.
                            {topic.topicTypeId === TopicTypeId.EXAM ? 
                                <MultipleProblemPaths /> :
                                <ProblemPath />
                            }
                        </Grid>{topic.topicTypeId !== TopicTypeId.EXAM && (<Grid item md={12}>
                            Enter the maximum number of graded attempts for a problem, use 0 or -1 to give students unlimited attempts.<br/>
                            <ProblemMaxAttempts />
                        </Grid>)}<Grid item md={12}>
                            Enter the number of points available for this problem. If the problem is marked as &quot;optional&quot;, these points will be treated as extra credit.<br/>
                            <ProblemWeight />
                        </Grid><Grid item md={12}>
                            This problem is {optional ? 'optional' : 'required'}.<br/>
                            <OptionalField />
                        </Grid>
                        {topic.topicTypeId === TopicTypeId.EXAM && (
                            <Grid item md={12}>
                                <Grid item md={10}>
                                    You can optionally limit the randomization of this problem by entering specific &quot;random seeds&quot; (numeric values between 1 and 999999) into the text field below. 
                                    Use the problem preview pane below to see how different &quot;seeds&quot; affect the randomization. You can add multiple numbers by pressing enter or using a comma to separate them.<br/>
                                </Grid>
                                <RandomSeedSet />
                            </Grid>
                        )}
                    </Grid><Grid item xs={12}>
                        <RendererPreview 
                            defaultPath={topic.topicTypeId === TopicTypeId.EXAM ? 
                                additionalProblemPaths?.[0].path || '' : 
                                webworkQuestionPath} 
                        />
                    </Grid>
                    <Grid container item md={12} alignItems='flex-start' justify="flex-end" >
                        <Grid container item md={4} spacing={3} justify='flex-end'>
                            <Button
                                color='secondary'
                                variant='contained'
                                onClick={()=>{setShowConfirmDelete(true);}}
                                style={{marginRight: '1em'}}
                            >
                                Delete
                            </Button>
                            <Button
                                color='primary'
                                variant='contained'
                                type='submit'
                            >
                                Save Problem
                            </Button>
                        </Grid>
                    </Grid>
                </Grid>
                <ConfirmationModal
                    onConfirm={() => { onDelete(); setShowConfirmDelete(false); }}
                    onHide={() => {
                        setShowConfirmDelete(false);
                    }}
                    show={showConfirmDelete}
                    headerContent={<h5>Confirm delete</h5>}
                    bodyContent={`Are you sure you want to remove Problem ${selected.problemNumber}?`}
                />
            </form>
        </FormProvider>
    );
};

export default ProblemSettings;