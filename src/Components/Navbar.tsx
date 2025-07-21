import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import dalogo from "/src/assets/dalogo.png";
import axios from "axios";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [roleId, setRoleId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [modalType, setModalType] = useState<'success' | 'error'>('success');
  const navigate = useNavigate();

  useEffect(() => {
    const role = localStorage.getItem("role_Id"); // Changed from "role" to "role_Id"
    if (role) {
      setRoleId(parseInt(role));
      console.log("Current role_Id:", role); // Debug log
    }
  }, []);

  // Add Modal component
  const MessageModal = () => {
    if (!isModalOpen) return null;

    return (
      <div className="fixed inset-0 backdrop-blur-sm bg-white/30 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-xl">
          <h2 className={`text-xl font-bold mb-4 ${modalType === 'error' ? 'text-red-600' : 'text-green-600'}`}>
            {modalType === 'success' ? 'Success' : 'Error'}
          </h2>
          <p className="mb-6">{modalMessage}</p>
          <button
            onClick={() => {
              setIsModalOpen(false);
              if (modalMessage.includes("logged out")) {
                navigate("/login");
              }
            }}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Close
          </button>
        </div>
      </div>
    );
  };

  // Update handleLogout
  const handleLogout = async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      setModalMessage("Already logged out.");
      setModalType('error');
      setIsModalOpen(true);
      navigate('/login');
      return;
    }

    try {
      await axios.post(
        "http://127.0.0.1:8000/logout/", 
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      // Remove all auth-related items from localStorage
      localStorage.removeItem("token");
      localStorage.removeItem("emp");
      localStorage.removeItem("role_Id");

      // Show success modal
      setModalMessage("Logged out successfully");
      setModalType('success');
      setIsModalOpen(true);

      // Wait for modal to be visible before navigating
      setTimeout(() => {
        navigate('/login');
      }, 2000); // 2 second delay to show modal

    } catch (err) {
      console.error("Logout failed:", err);
      
      // Still remove tokens
      localStorage.removeItem("token");
      localStorage.removeItem("emp");
      localStorage.removeItem("role_Id");
      
      // Show error modal
      setModalMessage("Logout failed. Please try again.");
      setModalType('error');
      setIsModalOpen(true);
      
      // Navigate after showing error
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    }
  };

  return (
    <nav className="w-full fixed top-0 bg-green-800 px-4 py-3 shadow-md z-50">
      <div className="flex justify-between items-center">
        {/* Logo */}
        <div className="flex items-center">
          <img src={dalogo} alt="dalogo" className="h-15 w-15 " />
        </div>

        {/* Hamburger Icon (for mobile) */}
        <div className="md:hidden">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="text-white focus:outline-none"
          >
            {isOpen ? (
              <span className="text-3xl text-white" >✕</span> // Close icon
            ) : (
              <span className="text-3xl">☰</span> // Hamburger icon
            )}
          </button>
        </div>

        {/* Navigation Links */}
        <div
          className={`md:flex md:items-center md:space-x-8 ${
            isOpen ? "block" : "hidden"
          } absolute md:static top-16 left-0 w-full md:w-auto bg-green-800 md:bg-transparent md:flex-row flex flex-col items-center space-y-4 md:space-y-0 py-4 md:py-0`}
        >
          {roleId === 4 && (
            <a
              href="personnel"
              className="group text-white lg:text-lg md:text-base s:text-base font-light tracking-wide relative"
            >
              Personnel
              <span className="absolute -bottom-1 left-0 w-full h-[2px] bg-white transform scale-x-0 group-hover:scale-x-100 group-hover:origin-left transition duration-300"></span>
            </a>
          )}

          {/* Show Time Log and Register Face only if NOT role 7 */}
          {roleId !== 7 && (
            <>
              <a
                href="timelog"
                className="group text-white lg:text-lg md:text-base s:text-base font-light tracking-wide relative"
              >
                Time Log
                <span className="absolute -bottom-1 left-0 w-full h-[2px] bg-white transform scale-x-0 group-hover:scale-x-100 group-hover:origin-left transition duration-300"></span>
              </a>
              
              <a
                href="livefeed"
                className="group text-white lg:text-lg md:text-base s:text-base font-light tracking-wide relative"
              >
                Register Face
                <span className="absolute -bottom-1 left-0 w-full h-[2px] bg-white transform scale-x-0 group-hover:scale-x-100 group-hover:origin-left transition duration-300"></span>
              </a>
            </>
          )}

          {/* Show Time-In/Time-out only for role 7 */}
          {roleId === 7 && (
            <a
              href="facerecog"
              className="group text-white lg:text-lg md:text-base s:text-base font-light tracking-wide relative"
            >
              Time-In/Time-out
              <span className="absolute -bottom-1 left-0 w-full h-[2px] bg-white transform scale-x-0 group-hover:scale-x-100 group-hover:origin-left transition duration-300"></span>
            </a>
          )}

          {/* Logout Button */}
          <button onClick={handleLogout}
          className="outline outline-offset-2 outline-white rounded-xl xl:ml-20 px-6 py-2 text-white font-montserrat">
            Logout
          </button>
        </div>
      </div>
      <MessageModal />
    </nav>
  );
};

export default Navbar;
