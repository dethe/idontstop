#!/usr/bin/env python
#

import os
import urllib
import logging

from google.appengine.ext import blobstore
from google.appengine.ext.webapp import blobstore_handlers
from google.appengine.ext.webapp.util import run_wsgi_app
import webapp2 as webapp

MAX = 300

class MainHandler(webapp.RequestHandler):
    def get(self):
        upload_url = blobstore.create_upload_url('/upload')
        self.response.out.write('<html><body>')
        self.response.out.write('<form action="%s" method="POST" enctype="multipart/form-data">' % upload_url)
        self.response.out.write("""Upload File: <input type="file" name="file"><br> <input type="submit" name="submit" value="Submit"> </form>""")
        self.response.out.write('<ul>')
        for info in blobstore.BlobInfo.all().order('creation').fetch(limit=MAX, offset=0):
            self.response.out.write('<li><a href="%s">%s</a> (%s)</li>' % ('/serve/%s' % info.key(), info.filename, info.creation.date().isoformat()))
        self.response.out.write('</ul>')
        self.response.out.write('<p>There are %d items in the blobstore</p>' % blobstore.BlobInfo.all().count());
        self.response.out.write("""</body></html>""")

class UploadHelper(webapp.RequestHandler):
    def get(self):
        upload_url = blobstore.create_upload_url('/upload')
        self.response.headers.add_header('Content-Type', 'text/plain')
        self.response.out.write(upload_url)

# Content-type: audio/x-caf

class UploadHandler(blobstore_handlers.BlobstoreUploadHandler):
    def post(self):
        upload_files = self.get_uploads('file')  # 'file' is file upload field in the form
        # If there are more than MAX files, delete the overage
        total = blobstore.BlobInfo.all().count()
        if total > MAX:
        	overage = total - MAX
        	for blob in blobstore.BlobInfo.all().order('creation').fetch(limit=overage, offset=0):
        		blob.delete()
        # blob_info = self.get_uploads('file')[0]
        # self.redirect('/serve/%s' % blob_info.key())
        self.redirect('/')

class ServeHandler(blobstore_handlers.BlobstoreDownloadHandler):
    def get(self, resource):
        resource = str(urllib.unquote(resource))
        blob_info = blobstore.BlobInfo.get(resource)
        self.response.headers.add_header('Meta', 'HTTP_EQUIV="CACHE-CONTROL", CONTENT="NO-CACHE"')
        self.send_blob(blob_info)

class RandomHandler(blobstore_handlers.BlobstoreDownloadHandler):
    def get(self):
        from random import choice
        resource = choice(blobstore.BlobInfo.all().filter('content_type =', 'application/octet-stream').fetch(limit=MAX, offset=0)).key()
        # logging.info('Returning %s at random', resource)
        blob_info = blobstore.BlobInfo.get(resource)
        self.send_blob(blob_info)

class RandomWavHandler(blobstore_handlers.BlobstoreDownloadHandler):
    def get(self):
        from random import choice
        resource = choice(blobstore.BlobInfo.all().filter('content_type =', 'audio/x-wav').fetch(limit=MAX, offset=0)).key()
        # logging.info('Returning %s at random', resource)
        blob_info = blobstore.BlobInfo.get(resource)
        self.send_blob(blob_info)

app = webapp.WSGIApplication(
      [('/test', MainHandler),
       ('/upload', UploadHandler),
       ('/getuploadurl', UploadHelper),
       ('/serve/([^/]+)?', ServeHandler),
       ('/random', RandomHandler),
       ('/randomwav', RandomWavHandler),
      ], debug=True)
