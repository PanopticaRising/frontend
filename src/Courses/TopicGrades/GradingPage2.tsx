import { Grid } from '@material-ui/core';
import React, { useEffect, useState } from 'react';
import _ from 'lodash';
import { Row, Col } from 'react-bootstrap';
import { useParams } from 'react-router-dom';
import logger from '../../Utilities/Logger';
import MaterialBiSelect from '../../Components/MaterialBiSelect';
import { useCourseContext } from '../CourseProvider';
import { UserObject, TopicObject, ProblemObject, StudentWorkbookInterface, ProblemDict, StudentGradeDict } from '../CourseInterfaces';
import ProblemIframe from '../../Assignments/ProblemIframe';
import { getAssessmentProblemsWithWorkbooks } from '../../APIInterfaces/BackendAPI/Requests/CourseRequests';
import { GradeInfoHeader } from './GradeInfoHeader';

interface TopicGradingPageProps {
    topicId?: string;
    courseId?: string;
}

export const TopicGradingPage: React.FC<TopicGradingPageProps> = () => {
    enum pin {
        STUDENT,
        PROBLEM
    } 
    const params = useParams<TopicGradingPageProps>();
    const {users} = useCourseContext();
    const [problemMap, setProblemMap] = useState<Record<number, ProblemDict>>({});
    const [isPinned, setIsPinned] = useState<pin | null>(null); // pin one or the other, not both
    const [topic, setTopic] = useState<TopicObject | null>(null);
    const [problems, setProblems] = useState<ProblemObject[] | null>(null);
    const [selected, setSelected] = useState<{
        problem?: ProblemObject, 
        user?: UserObject,
        workbook?: StudentWorkbookInterface,
    }>({});
    const [selectedInfo, setSelectedInfo] = useState<{
        path?: string,
        seed?: number,
        grade?: StudentGradeDict,
        problem?: ProblemObject,
        workbooks?: Record<number, StudentWorkbookInterface>,
        workbook?: StudentWorkbookInterface,
    }>({});

    useEffect(() => {
        // console.log('GP2: topicId changed');
        (async () => {
            try {
                if (_.isNil(params.topicId)) {
                    logger.error('topicId is null');
                    throw new Error('An unexpected error has occurred');
                } else {
                    await fetchProblems(parseInt(params.topicId, 10));
                }
            } catch (e) {
                logger.error(e.message, e);
            }
        })();
    }, [params.topicId]);

    useEffect(() => {
        // console.log('GP2: different user or problem was selected');
        // when user and problem are selected - set the available workbooks and 
        // pick one workbook as the default for rendering
        // TODO: adjust for different policies -- best individual / best attempt
        let currentPath: string | undefined;
        let currentSeed: number | undefined;
        let currentUserGrade: StudentGradeDict | undefined;
        let currentWorkbooks: Record<number, StudentWorkbookInterface> | undefined;
        let currentWorkbook: StudentWorkbookInterface | undefined;
        
        if (!_.isNil(selected.problem) && !_.isNil(selected.user)) {
            if (!_.isNil(selected.problem.webworkQuestionPath)) {
                currentPath = selected.problem.webworkQuestionPath;
            } 
            if (!_.isNil(selected.problem.id) && !_.isNil(selected.user.id)) {
                const problemDict = problemMap[selected.problem.id];
                if (!_.isNil(problemDict.grades)) {
                    currentUserGrade = problemDict.grades[selected.user.id];
                    if (!_.isNil(currentUserGrade.randomSeed)) {
                        currentSeed = currentUserGrade.randomSeed;
                    }
                    const userProblemWorkbooks = currentUserGrade.workbooks;
                    const selectedWorkbookId = currentUserGrade.lastInfluencingAttemptId; // this can be expanded
                    if (!_.isNil(userProblemWorkbooks) && (!_.isEmpty(userProblemWorkbooks))) {
                        currentWorkbooks = userProblemWorkbooks;
                        if (!_.isNil(selectedWorkbookId)) {
                            currentWorkbook = userProblemWorkbooks[selectedWorkbookId];
                            if (_.isNil(currentWorkbook)) {
                                logger.error(`we were supposed to get workbook #${selectedWorkbookId}, but failed.`);
                            } else {
                                // console.log(currentWorkbook.id);
                                currentPath = undefined;
                                currentSeed = undefined;
                            }
                        } else {
                            logger.error(`student #${selected.user.id} has workbooks for problem #${selected.problem.id} but no target-able id`);
                            // console.log(currentUserGrade);
                        }
                    } else {
                        // no error - student simply has no workbooks
                        // what do we set to render instead?
                        // console.log('student has no workbooks for this problem');
                    }
                } else {
                    logger.error('will anything ever trigger this? It is a problem with NO grades?!');
                }
            } else {
                logger.error('User and problem are selected, but one is missing an id!');
            }
            // console.log(`GP2: setting "selectedInfo" workbook: ${currentWorkbook?.id}`);
            setSelectedInfo({
                path: currentPath,
                seed: currentSeed,
                problem: selected.problem,
                grade: currentUserGrade,
                workbooks: currentWorkbooks,
                workbook: currentWorkbook,
            });
            // setSelected({...selected, workbook: currentWorkbook});
        }
    }, [selected.problem, selected.user]);

    useEffect(() => {
        // console.log(`GP2: "selected" workbook is changing: ${selected.workbook?.id}, selectedInfo: ${selectedInfo.workbook?.id}`);
        if (_.isNil(selected.workbook)) {
            const currentPath = selectedInfo.problem?.webworkQuestionPath;
            const currentSeed = selectedInfo.grade?.randomSeed;
            setSelectedInfo({
                path: currentPath,
                seed: currentSeed,
                problem: selected.problem,
                grade: selectedInfo.grade,
                workbooks: selectedInfo.workbooks,
            });
        } else {
            setSelectedInfo({
                problem: selected.problem,
                grade: selectedInfo.grade,
                workbooks: selectedInfo.workbooks,
                workbook: selected.workbook,
            });
        }
    }, [selected.workbook]);

    const fetchProblems = async (topicId: number) => {
        const res = await getAssessmentProblemsWithWorkbooks({ topicId });
        const currentProblems: Array<ProblemObject> = _(res.data.data.problems)
            .map((p) => { return new ProblemObject(p); })
            .sortBy(['problemNumber'],['asc'])
            .value();
        // currentProblems = _.map(currentProblems, (p) => {return new ProblemObject(p);});
        setProblems(currentProblems);

        const currentTopic = res.data.data.topic;
        setTopic(currentTopic);

        if (!_.isEmpty(currentProblems)) {
            // const problemDictionary = deepKeyBy(problems, 'id') as Record<number, ProblemObject>;
            // https://stackoverflow.com/questions/40937961/lodash-keyby-for-multiple-nested-level-arrays
            const problemDictionary = _(currentProblems)
                .map( (obj) => {
                    return _.mapValues(obj, (val) => {
                        if (_.isArray(val)) {
                            return _(val)
                                .map((obj) => {
                                    return _.mapValues(obj, (val) => {
                                        if (_.isArray(val)) {
                                            return _.keyBy(val, 'id'); // workbooks by id
                                        } else {
                                            return val;
                                        }
                                    });
                                })
                                .keyBy('userId') // key grades by user
                                .value();
                        } else {
                            return val;
                        }
                    });
                })
                .keyBy('id')
                .value() as Record<number, ProblemDict>;
            setProblemMap(problemDictionary);
            const initialSelectedProblemId = _.sortBy(currentProblems, ['problemNumber'], ['asc'])[0].id;
            setSelected({ problem: problemDictionary[initialSelectedProblemId] as ProblemObject});
        } else { 
            // setError('No problems in this topic.');
        }
    };

    return (
        <Grid>
            <Row>
                <Col className='text-left'>
                    <h1>Grading {topic && topic.name}</h1>
                </Col>
            </Row>
            <Grid container spacing={1}>
                <Grid container item md={4}>
                    {problems && users &&
                        <MaterialBiSelect problems={problems} users={users} selected={selected} setSelected={setSelected} />
                    }
                </Grid>
                <Grid container item md={8} style={{paddingLeft: '1rem'}}>
                    { selectedInfo.grade &&
                        < GradeInfoHeader
                            grade={selectedInfo.grade}
                            workbookId={selectedInfo.workbook?.id}
                            selected={selected}
                            setSelected={setSelected}
                            onSuccess={() => {}}
                        />
                    }
                    {selectedInfo.problem && selected.user && selectedInfo.workbook && selectedInfo.workbook.id && (
                        < ProblemIframe
                            problem={selectedInfo.problem}
                            readonly={true}
                            workbookId={selectedInfo.workbook.id}
                        />
                    )}
                    {selectedInfo.problem && selectedInfo.path && selectedInfo.seed && (
                        < ProblemIframe
                            problem={selectedInfo.problem}
                            readonly={true}
                            previewPath={selectedInfo.path}
                            previewSeed={selectedInfo.seed}
                        />
                    )}
                </Grid>
            </Grid>
        </Grid>
    );
};

export default TopicGradingPage;