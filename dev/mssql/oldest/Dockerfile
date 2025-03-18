FROM mcr.microsoft.com/mssql/server:2017-latest

RUN ln -s /usr/lib/x86_64-linux-gnu/libcrypto.so.1.1 /opt/mssql/lib/libcrypto.so
RUN ln -s /usr/lib/x86_64-linux-gnu/libssl.so.1.1 /opt/mssql/lib/libssl.1.1

# Run SQL Server (same entrypoint as original image)
CMD ["/opt/mssql/bin/sqlservr"]

