import { useNavigate } from "react-router-dom";
import { useState } from "react";
import axios from 'axios';
import stamplogo from "/src/assets/STAMP2.png";
import stampfull from "/src/assets/stamp-full.png";
import { motion, AnimatePresence } from "framer-motion";


interface LoginFormData {
  email: string;
  password: string;
}

const BASE_URL = "https://172.16.200.95/stamp-backend/";


const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [showForm, setShowForm] = useState(false);

  const handleLogin = async (data: LoginFormData) => {
    try {
      const response = await axios.post(`${BASE_URL}login/`, data);
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('emp', response.data.emp);
      if (response.data.role !== undefined && response.data.role !== null) {
        localStorage.setItem('role_Id', response.data.role.toString());
        const roleId = response.data.role.toString();
        if (roleId === '7') {
          navigate('/facerecog');
        } else {
          navigate('/timelog'); 
        }
      } else {
        setModalMessage("Login response missing user role. Please contact admin.");
        setIsModalOpen(true);
      }
    } catch (error) {
      console.error("Error:", error);
      setModalMessage("An error occurred during login. Please try again.");
      setIsModalOpen(true);
    }
  };

  // Modal component
  const ErrorModal = () => {
    if (!isModalOpen) return null;

    return (
      <div className="fixed inset-0 backdrop-blur-sm bg-white/30 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-xl">
          <h2 className="text-xl font-bold mb-4 text-red-600">Error</h2>
          <p className="mb-6">{modalMessage}</p>
          <button
            onClick={() => setIsModalOpen(false)}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Close
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-[url(/src/assets/grass-bg.jpg)] bg-cover bg-center flex justify-center items-center">
      <ErrorModal />
      <div className="relative w-full max-w-md flex flex-col items-center justify-center h-2/3">
        {/* Card: Logo and (optionally) Login Button */}
        <motion.div
          key="card-btn"
          initial={false}
          animate={{ x: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 80 }}
          className="bg-white bg-opacity-90 p-8 rounded-lg shadow-lg w-full max-w-md flex flex-col items-center justify-center"
        >
          {/* Back Button appears above the logo when form is shown */}
          {showForm && (
            <button
              type="button"
              className="self-start mb-2 text-green-700 hover:underline font-semibold flex items-center"
              onClick={() => setShowForm(false)}
            >
              <span className="text-3xl mr-2">←</span>
            </button>
          )}
          <div className="flex items-center justify-center w-full">
            <img
              src={!showForm ? stamplogo : stampfull}
              className={!showForm ? "h-50" : "h-25"}
            />
          </div>
          {/* Show the login button only if the form is not shown */}
          {!showForm && (
            <button
              type="button"
              className="w-full bg-green-600 text-white font-semibold py-2 rounded-lg hover:bg-green-700 transition duration-300"
              onClick={() => setShowForm(true)}
            >
              Log In
            </button>
          )}
          {/* Login Form appears under the logo card */}
          <AnimatePresence mode="wait">
            {showForm && (
              <motion.form
                key="card-form"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20, transition: { duration: 0.3 } }}
                transition={{ type: "spring", stiffness: 80 }}
                className="flex flex-col space-y-4 w-full max-w-md mt-6"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleLogin({ email, password });
                }}
              >
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full px-4 py-2 border-b border-gray-300 focus:outline-none"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full px-4 py-2 border-b border-gray-300 focus:outline-none"
                />
                <button
                  type="submit"
                  className="w-full bg-green-600 text-white font-semibold py-2 rounded-lg hover:bg-green-700 transition duration-300"
                >
                  Log In
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
