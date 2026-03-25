import React from "react";
import { Navigate } from "react-router-dom";

const Protected = ({ children }) => {
  const token = localStorage.getItem("token");

  if (!token) {
    return <Navigate to="/" replace />; // redirect if not logged in
  }

  return children; // render the page if logged in
};

export default Protected;