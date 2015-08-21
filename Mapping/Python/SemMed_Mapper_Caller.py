# Author: Hayo Bart
# August 2015
# Project: Information Graphs Modelling Diabetes Disease
# MSc Information Studies
# Track: Business Information Systems
# University of Amsterdam

# INSTRUCTIONS FOR DATABASE CONNECTION ARE BELOW

__author__ = 'Hayo'

# import required packages
import argparse
import math
import mysql.connector
import os
import subprocess

class SemMedCaller():

    # Path to the directory where the SemMed_Mapper.py script is located
    semMedMapperPath = "/media/rdfdrive/processingdir"

    # Path to the directory where d2rq is located
    d2rqDir = "/media/rdfdrive/processingdir/d2rq-0.8.1"

    # Relative path (from the d2rq dir) to the directory where we store the log files
    logDir = "./semmed_db/logs"

    # Empty array to store SQL results
    results = []

    # Load the arguments from the commandline
    def loadArgs(self):

        parser = argparse.ArgumentParser()

        parser.add_argument("mode",
                            choices=["citations", "concepts", "original_statement_object", "original_statement_subject",
                                     "sentences", "statements"],
                            type=str,
                            help="Defines the modes in which the parser will run in terms of the classes that will be "
                                 "mapped. Specification of this argument allows the mapper to use the correct base "
                                 "mapping file, and as such generate the correct RDF, and write it to the appropriate "
                                 "directory. Value of this required argument can either be 'citations', "
                                 "'original_statement_object', 'original_statement_subject', 'concepts', 'statements', "
                                 "or 'sentences'.")
        parser.add_argument("--block_size",
                            type=int,
                            default=0,
                            help="Defines the size of the blocks in which the MySQL table will be processed. A block "
                                 "size of 100, for example, indicates that in this run of the script 100 rows of the "
                                 "MySQL table will be dumped to RDF. If no value is provided on the command line, "
                                 "block size will default to 0 (indicating that the entire MySQL table will be "
                                 "processed at once.")

        self.args = parser.parse_args()

    # collect items from the SemMed database
    def getDatabaseTableLength(self, mapperMode):

        print "Setting up database connection"

        # connect to the MySQL database
        # replace 'database_user' with the database user between quotes (e.g. 'root'))
        # replace 'database_password' with the database password between quotes
        # replace 'database_' with the database name containing SemMedDB, between quotes
        cnx = mysql.connector.connect(user = 'database_user',
                                      password = 'database_password',
                                      host = 'localhost',
                                      database = 'database_')
        cursor = cnx.cursor()

        # Set the base query to check the amount of rows in any table. The composite_concept runs override this
        # default because they create concepts from the table with predications
        query = "SELECT COUNT(*) FROM "
        if mapperMode == "citations":
            query = query + "CITATIONS"
        elif mapperMode == "concepts":
            query = query + "CONCEPT"
        elif mapperMode == "original_statement_object":
            query = "SELECT COUNT(DISTINCT o_cui) FROM PREDICATION_AGGREGATE"
        elif mapperMode == "orginal_statement_subject":
            query = "SELECT COUNT(DISTINCT s_cui) FROM PREDICATION_AGGREGATE"
        elif mapperMode == "sentences":
            query = query + "SENTENCE"
        elif mapperMode == "statements":
            query = query + "PREDICATION_AGGREGATE"

        print "Executing query: {0}".format(query)

        # Execute the query in the SemMed_DB
        cursor.execute(query)

        print "Parsing query results"

        # loop through the query results
        for identifier in cursor:

            # append the number of items in the table to the result array
            self.results.append(identifier[0])

        print "Close database connection"

        # close the connection to the database
        cnx.close()

    def run(self):

        # load the command line arguments and parse the mode we run the script in and the preferred size of the blocks
        self.loadArgs()
        mode = self.args.mode
        blockSize = self.args.block_size

        # get the number of entries in the database corresponding to the mode we run the script in and store it in
        # tableLength
        self.getDatabaseTableLength(mode)
        tableLength = self.results[0]

        # if the preferred blockSize is -1, we want to process the entire table at once and therefore we set the
        # blocksize to be equal to the number of items in the table
        if blockSize == 0:
            blockSize = tableLength

        # the maximum index to / from which we can loop is determined by the tableLength divided by the blocklength
        maxIndex = tableLength / blockSize

        # the start index is determined by rounding the maxIndex downwards
        startIndex = math.trunc(maxIndex)

        # loop through each of the blocks in decreasing order, starting with the last one and finishing with the first
        for index in xrange(startIndex, -1, -1):

            # change the directory to the d2rq directory
            os.chdir(self.d2rqDir)

            # create the required directories to store the log files, if they don't exist yet
            if not os.path.exists(self.logDir + "/" + mode):
                os.makedirs(self.logDir + "/" + mode)

            # change the directory to the directory where the SemMed_Mapper.py script is located
            os.chdir(self.semMedMapperPath)

            # create a log file for the specific subprocess that we're gonna run
            with open("./d2rq-0.8.1/semmed_db/logs/" + mode + "/log_subprocess_" + str(index) + ".txt", "w") \
                    as file_out:

                # define the python command that we need to process including the mode in which we need to run it,
                # the start_index and the block_size
                command = "python SemMed_Mapper.py " + mode + " --start_index " + str(index * blockSize) + \
                          " --block_size " + str(blockSize)

                print "Calling command " + command + " and running in background"

                # run the command in the shell and move it to the background. Write the standard output and errors
                # to the file we just created
                subprocess.Popen(command, shell=True, stdout=file_out, stderr=file_out)

if __name__ == "__main__":

    # instantiate the caller
    caller = SemMedCaller()

    # run the caller
    caller.run()