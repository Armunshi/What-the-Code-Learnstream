import BackgroundWrapper from "../components/BackgroundWrapper";
import Component from "../components/login-form";
import React from 'react'


function LoginT() {
  return (
    <BackgroundWrapper url="LearnStream/frontend/public/assets/teacher.jpeg">
    <Component role={"teacher"} />
    </BackgroundWrapper>
  )
}

export default LoginT