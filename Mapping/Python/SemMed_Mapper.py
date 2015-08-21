# Author: Hayo Bart
# August 2015
# Project: Information Graphs Modelling Diabetes Disease
# MSc Information Studies
# Track: Business Information Systems
# University of Amsterdam

# INSTRUCTIONS FOR DATABASE CONNECTION ARE BELOW
# ONLY WORKS ON LINUX / OSX; FOR WINDOWS REPLACE ./dump-rdf WITH dump-rdf.bat

__author__ = 'Hayo'

# import required packages
import argparse
import mysql.connector
import os
import subprocess
import urllib

class SemMedMapper():

    # Specify the URI for the ontology here
    ontologyURI = "http://purl.org/net/fcnmed/"

    # Path to the directory where d2rq is located
    d2rqDir = "/media/rdfdrive/processingdir/d2rq-0.8.1"

    # Relative paths to the directories where we store the base mapping files, the restricted mapping files and the
    # dumped RDF. Please do no change
    baseMapsDir = "./semmed_db/base_mappings"
    mappingDir = "./semmed_db/mappings"
    rdfDestinationDir = "./semmed_db/rdf"

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
                                 "'original_statement_object', 'original_statement_subject', 'concepts', "
                                 "'statements', or 'sentences'.")
        parser.add_argument("--start_index",
                            default=0,
                            type=int,
                            help="Defines the start index in the MySQL results for the query to be made. A start index "
                                 "of 10, for example, indicates that results will be returned starting from the 11th "
                                 "row in the MySQL result set. If no value is provided on the command line this defaults "
                                 "to 0.")
        parser.add_argument("--block_size",
                            default=0,
                            type=int,
                            help="Defines the size of the blocks in which the MySQL table will be processed. A block "
                                 "size of 100, for example, indicates that in this run of the script 100 rows of the "
                                 "MySQL table will be dumped to RDF. If no value is provided on the command line this "
                                 "defaults to 0")

        self.args = parser.parse_args()

    # collect items from the SemMed database
    def getDatabaseItems(self, mapperMode, startIndex, blockSize):

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

        # Select the query that corresponds to the mode in which we run the script, limit the queries according to
        # specified startIndex and blockSize to make processing more manageable
        query = ""
        if mapperMode == "citations":
            query = "SELECT DISTINCT PMID FROM CITATIONS "
        elif mapperMode == "concepts":
            query = "SELECT DISTINCT CUI FROM CONCEPT "
        elif mapperMode == "original_statement_object":
            query = "SELECT DISTINCT o_cui FROM PREDICATION_AGGREGATE "
        elif mapperMode == "original_statement_subject":
            query = "SELECT DISTINCT s_cui FROM PREDICATION_AGGREGATE "
        elif mapperMode == "sentences":
            query = "SELECT DISTINCT SENTENCE_ID FROM SENTENCE "
        elif mapperMode == "statements":
            query = "SELECT DISTINCT PID FROM PREDICATION_AGGREGATE "

        if blockSize != 0:
            query = query + "LIMIT " + str(startIndex) + ", " + str(blockSize)

        print "Executing query: {0}".format(query)

        # Execute the query in the SemMed_DB
        cursor.execute(query)

        print "Parsing query results"

        # append each of the identifiers to the results array
        for identifier in cursor:

            # take appropriate actions for the different types of content in the results (e.g. unicode tuples or integers)
            if type(identifier[0]) == unicode:
                self.results.append(identifier[0].encode("ascii", "ignore"))

            elif type(identifier[0]) == int:
                self.results.append(identifier[0])

        print "Close database connection"

        # close the connection to the database
        cnx.close()

    # read the base mapping file and return its contents as a string
    def readBaseFile(self, mapperMode):

        print "Reading base mapping file (" + "semmed_db_mapping_" + mapperMode + "_base.ttl) from " + \
                self.baseMapsDir

        # change the current working directory to the d2rq-directory
        os.chdir(self.d2rqDir)

        # open and read the base mapping corresponding to the mode in which  we run the script and return its content
        baseFile = open(self.baseMapsDir + "/semmed_db_mapping_" + mapperMode +  "_base.ttl", "r")
        content = baseFile.read()
        baseFile.close()
        return content

    # write the mapping file to map one specific row in the database
    def writeRestrictedMappingFile(self, identifier, baseMapping, mapperMode):

        print "Writing restricted mapping file for " + mapperMode + " with id " + str(identifier)

        # change the current working directory to the d2rq-directory
        os.chdir(self.d2rqDir)

        # generate the restriction that needs to be added to the base mapping file to create the restricted mapping
        restriction = self.restrictionGenerator(identifier, mapperMode)

        # compose the restricted mapping file by appending the restriction
        restrictedMapping = baseMapping + restriction

        # create the required directories to store the mapping files, if they don't exist yet
        if not os.path.exists(self.mappingDir + "/" + mapperMode):
            os.makedirs(self.mappingDir + "/" + mapperMode)

        # write the restricted mapping file
        # url_encode the identifier in case it contains special characters to prevent crashing of the script
        path = self.mappingDir + "/" + mapperMode + "/semmed_db_mapping_" + mapperMode + "_" \
                                                                          + urllib.quote(str(identifier)) + ".ttl"
        restrictedFile = open(path, "w")
        restrictedFile.write(restrictedMapping)
        restrictedFile.close()

        print "Done writing restricted mapping file for " + mapperMode + " with id " + str(identifier)

    # generate the restriction that needs to be added to the base mapping file in order to create the restricted mapper
    # that maps one row from the database
    def restrictionGenerator(self, identifier, mapperMode):

        print "Selecting restriction(s) for " + mapperMode + " with id " + str(identifier)

        # select and return the appropriate restriction based on the mode we run the script in
        if mapperMode == "citations":
            condition = "map:academic_articles d2rq:condition \"PMID = '" + identifier + "'\".\n"
            restriction = condition
            return restriction

        elif mapperMode == "concepts":
            condition = "map:concept d2rq:condition \"CUI = '" + identifier + "'\".\n"
            restriction = condition
            return restriction

        elif mapperMode == "original_statement_object":
            condition = "map:originalStatementObject d2rq:condition \"o_cui = '" + identifier + "'\".\n"
            restriction = condition
            return restriction

        elif mapperMode == "original_statement_subject":
            condition = "map:originalStatementSubject d2rq:condition \"s_cui = '" + identifier + "'\".\n"
            restriction = condition
            return restriction

        elif mapperMode == "sentences":
            condition = "map:sentence d2rq:condition \"SENTENCE_ID = '" + str(identifier) + "'\".\n"
            restriction = condition
            return restriction

        elif mapperMode == "statements":
            condition = "map:statement d2rq:condition \"PID = '" + str(identifier) + "'\".\n"
            restriction = condition
            return restriction

    # dump the rdf for one database row by making use of the restricted mapping file that was created
    def dumpRestrictedRDF(self, identifier, mapperMode):

        print "Dumping RDF for " + mapperMode + " with id " + str(identifier)

        # change the current working directory to the d2rq-directory
        os.chdir(self.d2rqDir)

        # create the required directories to store the mapping files, if they don't exist yet
        if not os.path.exists(self.rdfDestinationDir + "/" + mapperMode):
            os.makedirs(self.rdfDestinationDir + "/" + mapperMode)

        # compose the dump-rdf command with the required arguments
        # url_encode the identifier in case it contains special characters to prevent crashing of the script
        command = "./dump-rdf " \
                  "-b " + self.ontologyURI + \
                  " -o " + self.rdfDestinationDir + "/" + mapperMode + "/semmed_db_rdf_" + mapperMode + "_" \
                                                                     + urllib.quote(str(identifier)) + ".ttl " \
                  "--verbose --debug " + \
                  self.mappingDir + "/" + mapperMode + "/semmed_db_mapping_" + mapperMode + "_" \
                                                                             + urllib.quote(str(identifier)) + ".ttl"

        # execute the command through the command line
        subprocess.call(command, shell=True)

        print "Done dumping RDF for " + mapperMode + " with id " + str(identifier)


    def run(self):

        # load the command line arguments and parse the mode we run the script in
        self.loadArgs()
        mode = self.args.mode
        startIndex = self.args.start_index
        blockSize = self.args.block_size

        # collect items from the database
        self.getDatabaseItems(mode, startIndex, blockSize)

        # read the base mapping file
        baseMapping = self.readBaseFile(mode)

        # for each of identifiers in the results from the database
        for identifier in self.results:

            # write the restricted mapping file
            self.writeRestrictedMappingFile(identifier, baseMapping, mode)

            # dump the SQL to rdf
            self.dumpRestrictedRDF(identifier, mode)

            # and remove the mapping file to prevent the disk from getting full :)
            # refer to the mapping file by encoding the identifier
            os.remove(self.mappingDir + "/" + mode + "/semmed_db_mapping_" + mode + "_"
                                      + urllib.quote(str(identifier)) + ".ttl")

if __name__ == "__main__":

    # instantiate the mapper
    mapper = SemMedMapper()

    # run the mapper
    mapper.run()