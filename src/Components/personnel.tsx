import { useState, useEffect } from "react";
import Navbar from "./Navbar";
import React from "react";
import axios from 'axios';
import Loading from "./loading";

interface EmployeeData {
  request_id: number;
  emp_no: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  image: Blob | null;
  date_requested: string;
  approval_status: 'pending' | 'approved' | 'rejected';
  approval_date: string | null;
}

interface IPAddressData {
  employee_name: string;
  ip: string;
  added_by_name: string;
  date_added: string;
}

interface TimelogData {
  LOG_DATE: string;
  LOG_TIME: string;
  LOG_MODE: string;
  emp_no: string;
  employee_name: string;
}

const Personnel = () => {
  const [employeeList, setEmployeeList] = useState<EmployeeData[]>([]);
  const [historyList, setHistoryList] = useState<EmployeeData[]>([]);
  const [ipAddressList, setIPAddressList] = useState<IPAddressData[]>([]);
  const [timelogList, setTimelogList] = useState<TimelogData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'history' | 'ipAddress' | 'timelog'>('pending');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [modalType, setModalType] = useState<'success' | 'error'>('error');
  const [isAddIPModalOpen, setIsAddIPModalOpen] = useState(false);
  const [newIPData, setNewIPData] = useState({ ip: "" }); // Changed from ip_address to ip

  // Add these state variables after other useState declarations
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const logsPerPage = 8;

  const fetchValidationData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await axios.get('http://127.0.0.1:8000/get_validation_data/', {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'json'
      });

      if (!response.data || !Array.isArray(response.data)) {
        console.error('Invalid response data format:', response.data);
        return;
      }

      const latestRequests = response.data.reduce((acc: any, curr: any) => {
        if (!acc[curr.emp_no] || 
            new Date(curr.date_requested) > new Date(acc[curr.emp_no].date_requested)) {
          acc[curr.emp_no] = curr;
        }
        return acc;
      }, {});

      const formattedData = Object.values(latestRequests).map((item: any) => {
        const imageBlob = item.image
          ? new Blob(
              [Uint8Array.from(atob(item.image), c => c.charCodeAt(0))],
              { type: 'image/jpeg' }
            )
          : null;

        return {
          request_id: item.request_id,
          emp_no: item.emp_no,
          first_name: item.first_name,
          middle_name: item.middle_name,
          last_name: item.last_name,
          image: imageBlob,
          date_requested: new Date(item.date_requested).toISOString(),
          approval_status: (item.approval_status?.toLowerCase() || 'pending') as 'pending' | 'approved' | 'rejected',
          approval_date: item.approval_date ? new Date(item.approval_date).toISOString() : null
        };
      });

      setEmployeeList(formattedData);
    } catch (error) {
      console.error('Error fetching validation data:', error);
      if (axios.isAxiosError(error)) {
        console.error('Response:', error.response?.data);
        console.error('Status:', error.response?.status);
      }
    }
  };

  const fetchHistoryData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await axios.get('http://127.0.0.1:8000/get_validation_history/', {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'json'
      });

      if (!response.data || !Array.isArray(response.data)) {
        console.error('Invalid history data format:', response.data);
        return;
      }

      const latestRecords = response.data.reduce((acc: any, curr: any) => {
        if (!acc[curr.emp_no] || new Date(curr.approval_date) > new Date(acc[curr.emp_no].approval_date)) {
          acc[curr.emp_no] = curr;
        }
        return acc;
      }, {});

      const formattedData = Object.values(latestRecords).map((item: any) => ({
        request_id: item.request_id,
        emp_no: item.emp_no,
        first_name: item.first_name,
        middle_name: item.middle_name,
        last_name: item.last_name,
        image: item.image ? new Blob(
          [Uint8Array.from(atob(item.image), c => c.charCodeAt(0))],
          { type: 'image/jpeg' }
        ) : null,
        date_requested: new Date(item.date_requested).toISOString(),
        approval_status: item.approval_status.toLowerCase(),
        approval_date: item.approval_date ? new Date(item.approval_date).toISOString() : null
      }));

      setHistoryList(formattedData);
    } catch (error) {
      console.error('Error fetching history data:', error);
    }
  };

  const fetchIPAddressData = async () => {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('No authentication token found');
        }

        const response = await axios.get('http://127.0.0.1:8000/get_ip_address_data/', {
            headers: { Authorization: `Bearer ${token}` },
            responseType: 'json'
        });

        console.log('IP Address Data Response:', response.data); // Add this log

        if (!response.data || !Array.isArray(response.data)) {
            console.error('Invalid IP address data format:', response.data);
            return;
        }

        const formattedData = response.data.map((item: any) => ({
          employee_name: item.employee_name,
          ip: item.ip,
          added_by_name: item.added_by_name,
          date_added: new Date(item.date_added).toISOString()
        }));

        console.log('Formatted IP Address Data:', formattedData); // Add this log
        setIPAddressList(formattedData);
    } catch (error) {
        console.error('Error fetching IP address data:', error);
    }
  };

  const handleAddIPAddress = async () => {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            setModalMessage('Please log in again');
            setModalType('error');
            setIsModalOpen(true);
            return;
        }

        if (!newIPData.ip) { // Changed from ip_address to ip
            setModalMessage('Please enter an IP address');
            setModalType('error');
            setIsModalOpen(true);
            return;
        }

        // Basic IP address validation
        const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
        if (!ipRegex.test(newIPData.ip)) { // Changed from ip_address to ip
            setModalMessage('Please enter a valid IP address (e.g., 192.168.1.1)');
            setModalType('error');
            setIsModalOpen(true);
            return;
        }

        const formData = new FormData();
        formData.append("ip", newIPData.ip); // Changed from ip_address to ip

        const response = await axios.post(
            'http://127.0.0.1:8000/add_ip_address/',
            formData,
            {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            }
        );

        if (response.data.message) {
            await fetchIPAddressData();
            setIsAddIPModalOpen(false);
            setNewIPData({ ip: "" }); // Changed from ip_address to ip
            setModalMessage('IP address added successfully');
            setModalType('success');
            setIsModalOpen(true);
        }
    } catch (error) {
        console.error('Error adding IP address:', error);
        setModalMessage('Error adding IP address');
        setModalType('error');
        setIsModalOpen(true);
    }
  };

  const handleDeleteIP = async (ip: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setModalMessage('Please log in again');
        setModalType('error');
        setIsModalOpen(true);
        return;
      }

      const response = await axios.delete(
        `http://127.0.0.1:8000/delete_ip_address/?ip=${ip}`,  // Add as query parameter
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.message) {
        await fetchIPAddressData();
        setModalMessage('IP address deleted successfully');
        setModalType('success');
        setIsModalOpen(true);
      }
    } catch (error) {
      console.error('Error deleting IP address:', error);
      setModalMessage('Error deleting IP address');
      setModalType('error');
      setIsModalOpen(true);
    }
  };

  const fetchTimelogData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await axios.get('http://127.0.0.1:8000/get_timelog_data/', {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'json'
      });

      if (!response.data || !Array.isArray(response.data)) {
        console.error('Invalid timelog data format:', response.data);
        return;
      }

      const formattedData = response.data.map((item: any) => ({
        LOG_DATE: new Date(item.LOG_DATE).toISOString(),
        LOG_TIME: item.LOG_TIME,
        LOG_MODE: item.LOG_MODE,
        emp_no: item.emp_no,
        employee_name: item.employee_name
      }));

      setTimelogList(formattedData);
    } catch (error) {
      console.error('Error fetching timelog data:', error);
    }
  };

  const fetchAllTimelogs = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await axios.get('http://127.0.0.1:8000/get_all_timelogs/', {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'json'
      });

      if (!response.data || !Array.isArray(response.data)) {
        console.error('Invalid timelog data format:', response.data);
        return;
      }

      const sortedLogs = response.data.sort((a: TimelogData, b: TimelogData) => {
        const dateA = new Date(`${a.LOG_DATE} ${a.LOG_TIME}`);
        const dateB = new Date(`${b.LOG_DATE} ${b.LOG_TIME}`);
        return dateB.getTime() - dateA.getTime();
      });

      setTimelogList(sortedLogs);
    } catch (error) {
      console.error('Error fetching timelog data:', error);
    }
  };

  const handleAddTimelog = async (timelog: Omit<TimelogData, 'LOG_DATE'>) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setModalMessage('Please log in again');
        setModalType('error');
        setIsModalOpen(true);
        return;
      }

      const formData = new FormData();
      formData.append('emp_no', timelog.emp_no);
      formData.append('LOG_TIME', timelog.LOG_TIME);
      formData.append('LOG_MODE', timelog.LOG_MODE);

      const response = await axios.post(
        'http://127.0.0.1:8000/add_timelog/',
        formData,
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      if (response.data.message) {
        await fetchTimelogData();
        setModalMessage('Timelog added successfully');
        setModalType('success');
        setIsModalOpen(true);
      }
    } catch (error) {
      console.error('Error adding timelog:', error);
      setModalMessage('Error adding timelog');
      setModalType('error');
      setIsModalOpen(true);
    }
  };

  const handleDeleteTimelog = async (empNo: string, logDate: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setModalMessage('Please log in again');
        setModalType('error');
        setIsModalOpen(true);
        return;
      }

      const response = await axios.delete(
        `http://127.0.0.1:8000/delete_timelog/?emp_no=${empNo}&log_date=${logDate}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.message) {
        await fetchTimelogData();
        setModalMessage('Timelog deleted successfully');
        setModalType('success');
        setIsModalOpen(true);
      }
    } catch (error) {
      console.error('Error deleting timelog:', error);
      setModalMessage('Error deleting timelog');
      setModalType('error');
      setIsModalOpen(true);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        await Promise.all([
          fetchValidationData(),
          fetchHistoryData(),
          fetchIPAddressData(),
          fetchTimelogData()
        ]);
      } finally {
        setTimeout(() => {
          setIsLoading(false);
        }, 1000);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    console.log('IP Address List Updated:', ipAddressList);
  }, [ipAddressList]);

  // Add this useEffect after your other useEffect hooks
  useEffect(() => {
    setCurrentPage(1); // Reset to first page when changing tabs
  }, [activeTab]);

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
            onClick={() => setIsModalOpen(false)}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Close
          </button>
        </div>
      </div>
    );
  };

  const AddIPModal = () => {
    if (!isAddIPModalOpen) return null;

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setNewIPData({ ip: value });
    };

    return (
      <div className="fixed inset-0 backdrop-blur-sm bg-white/30 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-xl w-96">
          <h2 className="text-xl font-bold mb-4">Add IP Address</h2>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">IP Address</label>
            <input
              type="text"
              value={newIPData.ip}
              onChange={handleInputChange}
              className="mt-1 block w-full border border-gray-300 rounded-md p-2"
              placeholder="Enter IP address (e.g., 192.168.1.1)"
              autoFocus
            />
          </div>
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => {
                setIsAddIPModalOpen(false);
                setNewIPData({ ip: "" }); // Changed from ip_address to ip
              }}
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={handleAddIPAddress}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    );
  };

  const handleImageAction = async (empNo: string, action: "approved" | "rejected") => {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            setModalMessage('Please log in again');
            setModalType('error');
            setIsModalOpen(true);
            return;
        }

        const formData = new FormData();
        formData.append('emp_no', empNo);
        // Fix: Use "Approved" instead of "approved"
        const statusValue = action === "approved" ? "Approved" : "Rejected";
        formData.append('currstatus', statusValue);
        formData.append('approval_date', new Date().toISOString());

        const response = await axios.post(
            'http://127.0.0.1:8000/update_approval_status/',
            formData,
            {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            }
        );

        if (response.data.message) {
            if (action === "approved") {
                // Wait for server to process
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Update image in timelog
                await fetchHistoryData();
            }
            
            // Remove from pending list
            setEmployeeList((prevList) =>
                prevList.filter((emp) => emp.emp_no !== empNo)
            );
            
            setModalMessage(`Request ${action} successfully`);
            setModalType('success');
            setIsModalOpen(true);
        }
    } catch (error) {
        console.error('Error updating approval status:', error);
        setModalMessage('Error updating approval status');
        setModalType('error');
        setIsModalOpen(true);
    }
  };

  const handleTabChange = async (tab: 'pending' | 'history' | 'ipAddress' | 'timelog') => {
    setActiveTab(tab);
    if (tab === 'history') {
      await fetchHistoryData();
    } else if (tab === 'ipAddress') {
      await fetchIPAddressData();
    } else if (tab === 'timelog') {
      await fetchAllTimelogs();
    }
  };

  // Add this function before the return statement
  const filteredLogs = timelogList.filter(log =>
    log.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.LOG_DATE.includes(searchTerm) ||
    log.LOG_TIME.includes(searchTerm) ||
    log.LOG_MODE.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Modify the pagination calculations to use filteredLogs instead of timelogList
  const indexOfLastLog = currentPage * logsPerPage;
  const indexOfFirstLog = indexOfLastLog - logsPerPage;
  const currentLogs = filteredLogs.slice(indexOfFirstLog, indexOfLastLog);
  const totalPages = Math.ceil(filteredLogs.length / logsPerPage);

  return (
    <div className="w-full h-screen flex flex-col overflow-hidden">
      {isLoading ? (
        <Loading />
      ) : (
        <>
          <Navbar />
          {/* Tab Buttons */}
          <div className="flex justify-center space-x-4 mt-28">
            <button
              className={`px-4 py-2 rounded ${
                activeTab === 'pending' ? 'bg-blue-500 text-white' : 'bg-gray-200'
              }`}
              onClick={() => handleTabChange('pending')}
            >
              Pending Approvals
            </button>
            <button
              className={`px-4 py-2 rounded ${
                activeTab === 'history' ? 'bg-blue-500 text-white' : 'bg-gray-200'
              }`}
              onClick={() => handleTabChange('history')}
            >
              History
            </button>
            <button
              className={`px-4 py-2 rounded ${
                activeTab === 'ipAddress' ? 'bg-blue-500 text-white' : 'bg-gray-200'
              }`}
              onClick={() => handleTabChange('ipAddress')}
            >
              Endpoints
            </button>
            <button
              className={`px-4 py-2 rounded ${
                activeTab === 'timelog' ? 'bg-blue-500 text-white' : 'bg-gray-200'
              }`}
              onClick={() => handleTabChange('timelog')}
            >
              Employee's Timelog
            </button>
          </div>

          {/* Add IP Address Button and Search Bar Container */}
          <div className="flex justify-between items-center px-8 pb-0"> {/* Changed p-4 to px-8 pb-0 */}
            {/* IP Address Button */}
            {activeTab === 'ipAddress' && (
              <button
                onClick={() => setIsAddIPModalOpen(true)}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Add IP Address
              </button>
            )}
            
            {/* Search Bar for Timelogs - Modified width and padding to match container */}
            {activeTab === 'timelog' && (
              <div className="w-full mt-5">
                <input
                  type="text"
                  placeholder="Search by Employee Name"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>

          <div className="flex px-8 pb-2 pt-4 h-[calc(100vh-160px)]">
            <div className="w-full bg-gray-100 px-6 pt-6 pb-2 rounded-lg flex flex-col">
              <div className="overflow-auto flex-1">
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 bg-gray-300">
                    <tr>
                      {activeTab === 'ipAddress' ? (
                        <>
                          <th className="p-2 border">Employee Name</th>
                          <th className="p-2 border">IP Address</th>
                          <th className="p-2 border">Date Added</th>
                          <th className="p-2 border">Actions</th>
                        </>
                      ) : activeTab === 'timelog' ? (
                        <>
                          
                        </>
                      ) : (
                        <>
                          <th className="p-2 border">Image</th>
                          <th className="p-2 border">Employee</th>
                          <th className="p-2 border">Date Requested</th>
                          <th className="p-2 border">Status</th>
                          {activeTab === 'pending' && <th className="p-2 border">Actions</th>}
                          {activeTab === 'history' && <th className="p-2 border">Approval Date</th>}
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {activeTab === 'pending' ? (
                      employeeList.map((emp, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="p-2 border">
                            {emp.image ? (
                              <img
                                src={URL.createObjectURL(emp.image)}
                                alt="Employee"
                                className="w-32 h-32 object-cover mx-auto"
                              />
                            ) : (
                              <span className="text-gray-500">No Image</span>
                            )}
                          </td>
                          <td className="p-2 border">{`${emp.first_name} ${emp.middle_name || ''} ${emp.last_name}`}</td>
                          <td className="p-2 border">{new Date(emp.date_requested).toLocaleString()}</td>
                          <td className="p-2 border">{emp.approval_status}</td>
                          <td className="p-2 border">
                            {emp.approval_status === "pending" && (
                              <>
                                <button
                                  onClick={() => handleImageAction(emp.emp_no, "approved")}
                                  className="bg-green-500 text-white px-2 py-1 rounded mr-2 hover:bg-green-600"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleImageAction(emp.emp_no, "rejected")}
                                  className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : activeTab === 'history' ? (
                      historyList.map((emp, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="p-2 border">
                            {emp.image ? (
                              <img
                                src={URL.createObjectURL(emp.image)}
                                alt="Employee"
                                className="w-32 h-32 object-cover mx-auto"
                              />
                            ) : (
                              <span className="text-gray-500">No Image</span>
                            )}
                          </td>
                          <td className="p-2 border">{`${emp.first_name} ${emp.middle_name || ''} ${emp.last_name}`}</td>
                          <td className="p-2 border">{new Date(emp.date_requested).toLocaleString()}</td>
                          <td className="p-2 border">
                            <span className={`px-2 py-1 rounded ${
                              emp.approval_status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {emp.approval_status}
                            </span>
                          </td>
                          <td className="p-2 border">
                            {emp.approval_date ? new Date(emp.approval_date).toLocaleString() : 'N/A'}
                          </td>
                        </tr>
                      ))
                    ) : activeTab === 'ipAddress' ? (
                      ipAddressList.map((ip, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="p-2 border">{ip.employee_name}</td>
                          <td className="p-2 border">{ip.ip}</td>
                          <td className="p-2 border">{new Date(ip.date_added).toLocaleString()}</td>
                          <td className="p-2 border">
                            <button
                              onClick={() => handleDeleteIP(ip.ip)}
                              className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <>
                        {activeTab === 'timelog' && (
                          <>
                            <table className="w-full border-collapse">
                              <thead className="sticky top-0 bg-gray-300">
                                <tr>
                                  <th className="p-2 border">Employee</th>
                                  <th className="p-2 border">Date</th>
                                  <th className="p-2 border">Time</th>
                                  <th className="p-2 border">Log Type</th>
                                </tr>
                              </thead>
                              <tbody>
                                {currentLogs.map((log, index) => (
                                  <tr key={index} className="hover:bg-gray-50">
                                    <td className="p-2 border">{log.employee_name}</td>
                                    <td className="p-2 border">{new Date(log.LOG_DATE).toLocaleDateString()}</td>
                                    <td className="p-2 border">{log.LOG_TIME}</td>
                                    <td className="p-2 border">{log.LOG_MODE}</td>
                                  </tr>
                                ))}
                                {filteredLogs.length === 0 && (
                                  <tr>
                                    <td colSpan={4} className="p-2 border text-center text-gray-500">
                                      No matching records found
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>

                            {/* Pagination controls using filteredLogs.length */}
                            {filteredLogs.length > 0 && (
                              <div className="flex justify-center items-center mt-4 space-x-2">
                                <button
                                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                  disabled={currentPage === 1}
                                  className={`px-3 py-1 rounded ${
                                    currentPage === 1 
                                      ? 'bg-gray-300 cursor-not-allowed' 
                                      : 'bg-blue-500 text-white hover:bg-blue-600'
                                  }`}
                                >
                                  Previous
                                </button>
                                <span className="text-gray-600">
                                  Page {currentPage} of {totalPages}
                                </span>
                                <button
                                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                  disabled={currentPage === totalPages}
                                  className={`px-3 py-1 rounded ${
                                    currentPage === totalPages 
                                      ? 'bg-gray-300 cursor-not-allowed' 
                                      : 'bg-blue-500 text-white hover:bg-blue-600'
                                  }`}
                                >
                                  Next
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}
                    {employeeList.length === 0 && activeTab === 'pending' && (
                      <tr>
                        <td colSpan={5} className="p-2 border text-center text-gray-500">
                          No pending approvals
                        </td>
                      </tr>
                    )}
                    {historyList.length === 0 && activeTab === 'history' && (
                      <tr>
                        <td colSpan={5} className="p-2 border text-center text-gray-500">
                          No history records
                        </td>
                      </tr>
                    )}
                    {ipAddressList.length === 0 && activeTab === 'ipAddress' && (
                      <tr>
                        <td colSpan={4} className="p-2 border text-center text-gray-500">
                          No IP address records
                        </td>
                      </tr>
                    )}
                    {timelogList.length === 0 && activeTab === 'timelog' && (
                      <tr>
                        <td colSpan={4} className="p-2 border text-center text-gray-500">
                          No timelog records
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <MessageModal />
          <AddIPModal />
        </>
      )}
    </div>
  );
};

export default Personnel;