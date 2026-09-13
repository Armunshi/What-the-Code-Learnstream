import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "../api/axios";
import { useContext } from "react";
import AuthContext from "../contexts/AuthProvider";
import { ShoppingCart, Menu, X } from "lucide-react";
import { Avatar, AvatarFallback } from "./ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Button } from "./ui/button";

const navLinks = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/services", label: "Services" },
  { to: "/pricing", label: "Pricing" },
  { to: "/contact", label: "Contact" },
];

const Navbar1 = () => {
  const { auth, setAuth } = useContext(AuthContext);
  const navigate = useNavigate();
  const [cartCount, setCartCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const fetchCartCount = async () => {
      try {
        const response = await axios.get("/courses/cart", {
          headers: { Authorization: `Bearer ${auth?.accessToken}` },
          withCredentials: true,
        });
        setCartCount(response.data?.data?.items?.length || 0);
      } catch {
        setCartCount(0);
      }
    };

    if (auth?.accessToken && auth?.role === "student") {
      fetchCartCount();
    } else {
      setCartCount(0);
    }
  }, [auth?.accessToken, auth?.role]);

  const handleMyCourses = () => {
    navigate(`/${auth?.role}/${auth?.user_id}`);
  };

  const handleProfile = () => {
    navigate(`/${auth?.role}/${auth?.user_id}/profile`);
  };

  const handleLogout = async () => {
    try {
      const response = await axios.post(
        `/user/${auth?.role}/logout`,
        {},
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${auth?.accessToken}`,
          },
          withCredentials: true,
        }
      );

      if (response) {
        localStorage.clear();
        setAuth({});
        navigate("/");
      }
    } catch (error) {
      console.log(error);
    }
  };

  const initial = auth?.name?.charAt(0).toUpperCase() || "?";

  return (
    <nav className="border-b bg-white">
      <div className="max-w-container mx-auto px-4 md:px-8 flex items-center justify-between h-16">
        <Link to="/" className="font-league font-[700] text-xl">
          <span className="text-brand">Learn</span>Stream
        </Link>

        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link key={link.to} to={link.to} className="text-sm font-medium text-gray-700 hover:text-brand-dark">
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-4">
          {auth?.accessToken ? (
            <>
              {auth?.role === "student" && (
                <Link to="/cart" className="relative p-2">
                  <ShoppingCart size={20} />
                  {cartCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-brand text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                      {cartCount}
                    </span>
                  )}
                </Link>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button aria-label="Account menu">
                    <Avatar>
                      <AvatarFallback>{initial}</AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{auth?.name}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleMyCourses}>My Courses</DropdownMenuItem>
                  <DropdownMenuItem onClick={handleProfile}>Profile</DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout}>Sign out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="hidden sm:flex items-center gap-3">
              <Link to="/login" className="text-sm font-medium text-gray-700 hover:text-brand-dark">
                Log in
              </Link>
              <Button asChild size="sm" className="bg-brand-dark hover:bg-brand-dark/90">
                <Link to="/signup/student">Sign up</Link>
              </Button>
            </div>
          )}

          <button
            className="md:hidden p-2"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t px-4 py-3 flex flex-col gap-3">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="text-sm font-medium text-gray-700"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          {!auth?.accessToken && (
            <>
              <Link to="/login" className="text-sm font-medium text-gray-700" onClick={() => setMobileOpen(false)}>
                Log in
              </Link>
              <Link
                to="/signup/student"
                className="text-sm font-medium text-brand-dark"
                onClick={() => setMobileOpen(false)}
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar1;
