import { Button, Checkbox, Label, Spinner, TextInput } from "flowbite-react";

import { useRef, useState, useEffect, useContext } from 'react';
import AuthContext from "../contexts/AuthProvider";
import axios from '../api/axios';
import { tokenStore } from '../lib/api/tokenStore';

import { useNavigate } from "react-router-dom";
function Component({role}) {
    const navigate = useNavigate();
    const {auth } = useContext(AuthContext);
    const userRef = useRef();
    const errRef = useRef();
    const [user, setUser] = useState('');
    const [pwd, setPwd] = useState('');
    const [errMsg, setErrMsg] = useState('');

    useEffect(() => {
      console.log("Current AUth",auth);
        userRef?.current?.focus();
    }, [])

    useEffect(() => {
        setErrMsg('');
    }, [user, pwd])

    // Redirects once `auth` is actually populated, the same signal
    // Pages/login.jsx uses — not a separate local `success` flag, which used
    // to reference an undefined `userId` here and would throw the moment it
    // ran.
    useEffect(() => {
      if (auth?.user_id && auth?.role) {
        navigate(`/${auth.role}/${auth.user_id}`);
      }
    }, [auth, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            const response = await axios.post(`/user/${role}/login`,
                JSON.stringify({ email:user, password:pwd }),
                {
                    headers: { 'Content-Type': 'application/json' },
                    withCredentials: true 
                }
            );
            console.log(JSON.stringify(response?.data));
            //console.log(JSON.stringify(response));
            const accessToken = response?.data?.data?.accessToken;
            const user_id = response?.data?.data?.user._id
            // Named userRole, not role: a `const role = ...` here used to
            // redeclare the outer `role` prop within the same function body,
            // which is a temporal-dead-zone ReferenceError on the very
            // `${role}` reference above, the moment this ran — every submit
            // through this form crashed before the request was even sent.
            const userRole = response?.data?.data?.role;
            // tokenStore is the single source of truth AuthProvider derives
            // `auth` (including role) from — see contexts/AuthProvider.jsx.
            tokenStore.setToken(accessToken);
            navigate(`/${userRole}/${user_id}`);
            console.log('Current COntext',auth);
            setUser('');
            setPwd('');
        } catch (err) {
            console.log(err)
            if (!err?.response) {
                setErrMsg('No Server Response');
            } else if (err.response?.status === 400) {
                setErrMsg('Missing Username or Password');
            } else if (err.response?.status === 401) {
                setErrMsg('Unauthorized');
            } else {
                setErrMsg('Login Failed');
            }
            errRef.current.focus();
        }
    }

  return (
    auth?.accessToken ? (
      <>
      <Spinner/>
      </>

  ):(
    <form  onSubmit={handleSubmit} className="flex max-w-lg  flex-col gap-4">
    <p ref={errRef} className={errMsg ? "errmsg" : "offscreen"} aria-live="assertive">{errMsg}</p>
      {/* Email Field */}
      <div>
        <div className="mb-2 block">
          <Label htmlFor="email1" value="Your email" />
        </div>
        <TextInput 
          id="email"
          ref={userRef}
          autoComplete="off"
          onChange={(e) => setUser(e.target.value)}
          value={user}
          required  type="email" placeholder="email"  />
      </div>

      {/* Password Field */}
      <div>
        <div className="mb-2 block">
          <Label htmlFor="password1" value="Your password" />
        </div>
        <TextInput id="password1"
        type="password"
        onChange={(e) => setPwd(e.target.value)}
        value={pwd}
        required  />
      </div>

      {/* Remember Me Checkbox */}
      <div className="flex items-center gap-2">
        <Checkbox id="remember" />
        <Label htmlFor="remember">Remember me</Label>
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        className="bg-[#2a6411] text-white font-medium"
      >
        Submit
      </Button>
    </form>
  )
  );
}

export default Component;
