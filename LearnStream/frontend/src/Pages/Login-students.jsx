import BackgroundWrapper from "../components/BackgroundWrapper";
import Component from "../components/login-form";


function LoginT() {
  return (
    <BackgroundWrapper>
    <Component role={"student"} url={"../../public/assets/student.jpeg"}/>
    </BackgroundWrapper>
  )
}

export default LoginT