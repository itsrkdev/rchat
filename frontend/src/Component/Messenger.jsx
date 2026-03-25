import React, { useEffect } from 'react';
import Login from './Account/Login';
import { Box, AppBar, Toolbar } from '@mui/material';
import { useNavigate } from "react-router-dom";
import './Messenger.css';

export default function Messenger() {
  ;

    return (
        <Box className="box">
            <AppBar position="static" className="custom-appbar">
                <Toolbar></Toolbar>
            </AppBar>

            <Login />
        </Box>
    );
}
