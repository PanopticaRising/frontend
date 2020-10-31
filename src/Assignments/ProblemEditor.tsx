import React, { useEffect, useState } from 'react';
import { ProblemObject } from '../Courses/CourseInterfaces';
import { TextField, Button, Grid, FormControlLabel, Switch, InputAdornment, SwipeableDrawer } from '@material-ui/core';
import _ from 'lodash';
import { getUserId } from '../Enums/UserRole';
import logger from '../Utilities/Logger';
import ProblemIframe from './ProblemIframe';
import { Controller, useForm } from 'react-hook-form';
import {Controlled as CodeMirror} from 'react-codemirror2';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/material.css';
import 'codemirror/mode/xml/xml';
import 'codemirror/mode/perl/perl';
import 'codemirror/mode/javascript/javascript';
import { catalog, readProblem, saveProblem } from '../APIInterfaces/BackendAPI/Requests/CourseRequests';
import { nameof } from '../Utilities/TypescriptUtils';
import { FaCopy } from 'react-icons/fa';
import path from 'path';
import { Alert, Modal } from 'react-bootstrap';
import useAlertState from '../Hooks/useAlertState';

const defaultLoadPath = 'private/templates/barebones.pg';
const defaultUserPath = path.basename(defaultLoadPath);

const dumbyProblem = new ProblemObject();
interface PreviewProps {
    seedValue: number;
    problemSource?: string;
    showHints: boolean;
    showSolutions: boolean;
}

export interface ProblemEditorInputs extends PreviewProps {
    loadPath: string;
    userPath: string;
}

export const ProblemEditor: React.FC = () => {
    const [alertState, setAlertState] = useAlertState();
    const [previewState, setPreviewState] = useState<PreviewProps>({
        seedValue: 666,
        showHints: false,
        showSolutions: false,
        problemSource: undefined
    });

    const [myCatalog, setMyCatalog] = useState<Array<string>>([]);
    const [catalogOpen, setCatalogOpen] = useState<boolean>(false);

    const problemEditorForm = useForm<ProblemEditorInputs>({
        mode: 'onSubmit', 
        shouldFocusError: true,
        defaultValues: {
            loadPath: defaultLoadPath,
            userPath: defaultUserPath,
            ...previewState
        },
    });

    const { register, control } = problemEditorForm;
    const savePathAdornmentText = `private/my/${getUserId()}/`;

    const render = () => {
        setPreviewState({
            seedValue: problemEditorForm.getValues().seedValue,
            showHints: problemEditorForm.getValues().showHints,
            showSolutions: problemEditorForm.getValues().showSolutions,
            problemSource: problemEditorForm.getValues().problemSource,
        });
    };

    const load = async () => {
        try {
            const result = await readProblem({
                filePath: problemEditorForm.getValues().loadPath
            });
            problemEditorForm.setValue(nameof<ProblemEditorInputs>('problemSource'), result.data.data.problemSource);
            // let userPath = problemEditorForm.getValues().loadPath;
            // if (userPath.startsWith(savePathAdornmentText)) {
            //     userPath = userPath.substring(savePathAdornmentText.length);
            // }
            const userPath = path.basename(problemEditorForm.getValues().loadPath);
            problemEditorForm.setValue(nameof<ProblemEditorInputs>('userPath'), userPath);
            render();
        } catch(e) {
            logger.error('problemEditor: load: ', e.message);
            setAlertState({
                message: e.message,
                variant: 'danger'
            });
        }
    };

    const save = async () => {
        try {
            const { problemSource } = problemEditorForm.getValues();
            if(_.isNil(problemSource)) {
                return;
            }
            const result = await saveProblem({
                problemSource: problemSource,
                relativePath: problemEditorForm.getValues().userPath,
            });
            const savedPath = result.data.data.filePath;
            problemEditorForm.setValue(nameof<ProblemEditorInputs>('loadPath'), savedPath);
            setMyCatalog(myCatalog => [...myCatalog, savedPath]);
            setAlertState({
                message: 'Saved successfully',
                variant: 'success'
            });            
            render();
        } catch(e) {
            logger.error('problemEditor: save:', e.message);
            setAlertState({
                message: e.message,
                variant: 'danger'
            });
        }
    };

    const getCatalog = async () => {
        try {
            const result = await catalog();
            setMyCatalog([...myCatalog, ...result.data.data.problems]);
        } catch(e) {
            logger.error('problemEditor: getCatalog:', e.message);
            setAlertState({
                message: e.message,
                variant: 'danger'
            });
        }
    };

    const copySavePathToClipboard = () => {
        navigator.clipboard.writeText(`${savePathAdornmentText}${problemEditorForm.getValues().userPath}`);
    };

    const onFormChange = () => {
        setAlertState({
            message: '',
            variant: 'info'
        });
    };

    useEffect(() => {
        (async () => {
            const loadPromise = load();
            const catalogPromise = getCatalog();
            await Promise.all([loadPromise, catalogPromise]);    
        })();
    }, []);


    return (<form onChange={onFormChange}>
        <Modal
            onShow={()=>setCatalogOpen(true)}
            onHide={()=>setCatalogOpen(false)}
            show={catalogOpen}
        >
            <Modal.Header closeButton>
                <h6>My problems</h6>
            </Modal.Header>
            <Modal.Body>
                <ul style={{
                    padding: '10px',
                    listStyleType: 'none'
                }}>
                    {myCatalog.map(catalogProblem => 
                        <li key={catalogProblem}>
                            <Button variant='text' onClick={() => {
                                problemEditorForm.setValue(nameof<ProblemEditorInputs>('loadPath'), catalogProblem);
                                // Promise that doesn't need to be awaited
                                load();
                                setCatalogOpen(false);
                            }}>
                                {catalogProblem}
                            </Button>
                        </li>
                    )}
                </ul>
            </Modal.Body>
            <Modal.Footer>
                <Button onClick={() => setCatalogOpen(false)}>Close</Button>
            </Modal.Footer>
        </Modal>
        <Grid container item md={12}>
            {alertState.message &&
                <Alert style={{width: '100%'}} variant={alertState.variant}>{alertState.message}</Alert>
            }
        </Grid>
        <Grid container item md={12} spacing={2}>
            <Grid item md={10}>
                <TextField
                    name="loadPath" 
                    inputRef={register({
                        required: true, 
                    })}
                    label='Problem Path to Load'
                    type='text'
                    fullWidth={true}
                />
            </Grid>
            <Grid item md={2}>
                <Button
                    fullWidth={true}
                    style={{
                        height: '100%'
                    }}
                    variant="outlined"
                    onClick={() => {
                        load();
                        onFormChange();
                    }}
                >
                    Load
                </Button>
            </Grid>
        </Grid>
        <Grid container item md={12} spacing={2}>
            <Grid item md={10}>
                <TextField
                    name="userPath" 
                    inputRef={register({
                        required: true, 
                    })}
                    label='userPath'
                    type='text'
                    fullWidth={true}
                    InputProps={{
                        startAdornment: <InputAdornment position="start">{savePathAdornmentText}</InputAdornment>,
                        endAdornment: <InputAdornment position="end">
                            <Button variant='text'
                                tabIndex={0}
                                onClick={copySavePathToClipboard}
                                onKeyPress={copySavePathToClipboard}
                            >
                                <FaCopy /> Copy
                            </Button>
                        </InputAdornment>
                    }}
                />
            </Grid>
            <Grid item md={2}>
                <Button
                    fullWidth={true}
                    style={{
                        height: '100%'
                    }}
                    variant="outlined"
                    onClick={save}
                >
                    Save
                </Button>
            </Grid>
        </Grid>
        <Grid container item md={12} spacing={2}>
            <Grid item md={2}>
                <Button
                    fullWidth={true}
                    style={{
                        height: '100%'
                    }}
                    variant="outlined"
                    onClick={() => setCatalogOpen(true)}
                >
                    Open
                </Button>
            </Grid>
            <Grid item md={2} style ={{
                marginLeft: 'auto'
            }}>
                <TextField
                    name="seedValue" 
                    inputRef={register({
                        required: true, 
                    })}
                    label='seedValue'
                    type='number'
                    fullWidth={true}
                />
            </Grid>

            <Grid item md={4}>
                <Controller 
                    name="showHints"
                    control={control} 
                    defaultValue={false}
                    render={({ onChange, onBlur, value, name }) => (
                        <FormControlLabel
                            label="Show hints"
                            labelPlacement='start'
                            control={<Switch 
                                onBlur={onBlur}
                                onChange={e => onChange(e.target.checked)}
                                color='primary'
                                checked={value}
                                value={value}
                                name={name}
                            />}
                        />
                    )}
                />

                <Controller 
                    name="showSolutions"
                    control={control} 
                    defaultValue={false}
                    render={({ onChange, onBlur, value, name }) => (
                        <FormControlLabel
                            label="Show Solutions"
                            labelPlacement='start'
                            control={<Switch 
                                onBlur={onBlur}
                                onChange={e => onChange(e.target.checked)}
                                color='primary'
                                checked={value}
                                value={value}
                                name={name}
                            />}
                        />
                    )}
                />
            </Grid>
            <Grid item md={2}>
                <Button
                    fullWidth={true}
                    style={{
                        height: '100%'
                    }}
                    variant="outlined"
                    onClick={render}
                >
                    Render
                </Button>
            </Grid>
        </Grid>
        <Grid container item md={12} spacing={2}>
            <Grid item md={6}>
                <Controller
                    name="problemSource"
                    control={control} 
                    defaultValue={false}
                    render={({ onChange, value }) => (
                        <CodeMirror
                            options={{
                                mode: 'perl',
                                // dark theme
                                // theme: 'material',
                                lineNumbers: true,
                            }}
                            // According to the documentation example this is how you handle uncontrolled state
                            // putting this in onchange causes a page crash
                            onBeforeChange={(_editor, _data, value) => {
                                onFormChange();
                                onChange(value);
                            }}
                            // onChange={(editor, data, value) => {
                            // }}
                            value={value}
                        />
                    )}
                />
            </Grid>
            <Grid item md={6}>
                {!_.isNil(previewState.problemSource) &&
                <ProblemIframe
                    previewProblemSource={previewState.problemSource}
                    previewSeed={previewState.seedValue}
                    previewShowHints={previewState.showHints}
                    previewShowSolutions={previewState.showSolutions}
                    problem={dumbyProblem}
                />}
            </Grid>
        </Grid>
    </form>);
};