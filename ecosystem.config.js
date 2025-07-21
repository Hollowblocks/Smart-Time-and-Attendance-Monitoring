module.exports = {
    /**
     * An array of process objects to handle
     */
    apps: [
        // {
        //     name: "reverb", // Name for your Reverb process
        //     script: "php artisan reverb:start", // Command to run
        //     watch: true, // Watch for file changes and restart (optional)
        //     env: {
        //         NODE_ENV: "production", // Set environment variable (optional)
        //     },
        // },
        // {
        //     name: "pulse", // Name for your Pulse process
        //     script: "php artisan pulse:check",
        //     watch: true, // Watch for file changes and restart (optional)
        //     env: {
        //         NODE_ENV: "production", // Set environment variable (optional)
        //     },
        // },
        {
            name: "B for Backend", // Name for your Pulse process
            script: "uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4",
            watch: true, // Watch for file changes and restart (optional)
            env: {
                NODE_ENV: "production", // Set environment variable (optional)
            },
        }
    ],
};